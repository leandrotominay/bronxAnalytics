import {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  screen,
  session,
  type DesktopCapturerSource
} from 'electron'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWorker, PSM } from 'tesseract.js'

const currentDirectory = fileURLToPath(new URL('.', import.meta.url))
const require = createRequire(import.meta.url)
const englishDataDirectory = join(
  dirname(require.resolve('@tesseract.js-data/eng')),
  '4.0.0'
)
const leagueWindowTitle = 'League of Legends (TM) Client'
let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let overlayReady = false
let overlayActive = false
let pendingOverlayAlert: string | null = null
let authorizedCaptureSource: DesktopCapturerSource | null = null
let ocrWorker: Awaited<ReturnType<typeof createWorker>> | null = null
let ocrWorkerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null
let ocrQueue: Promise<void> = Promise.resolve()

function enqueueOcr<T>(operation: () => Promise<T>): Promise<T> {
  const result = ocrQueue.then(operation)
  ocrQueue = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

function isLeagueWindow(source: DesktopCapturerSource): boolean {
  return source.name.trim().toLocaleLowerCase() === leagueWindowTitle.toLocaleLowerCase()
}

function assertMainWindowSender(sender: Electron.WebContents): void {
  if (!mainWindow || sender !== mainWindow.webContents) {
    throw new Error('Capture requests are only accepted from the companion window.')
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 340,
    height: 300,
    minWidth: 280,
    minHeight: 220,
    title: 'League Event Companion',
    backgroundColor: '#10131b',
    webPreferences: {
      preload: join(currentDirectory, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(currentDirectory, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    authorizedCaptureSource = null
    overlayWindow?.close()
    overlayWindow = null
    overlayReady = false
    overlayActive = false
    pendingOverlayAlert = null
  })
}

function createOverlayWindow(): void {
  const displayBounds = screen.getPrimaryDisplay().bounds
  overlayWindow = new BrowserWindow({
    ...displayBounds,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: join(currentDirectory, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  overlayWindow.setAlwaysOnTop(true, 'floating')
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })

  if (process.env.ELECTRON_RENDERER_URL) {
    const overlayUrl = new URL('overlay.html', process.env.ELECTRON_RENDERER_URL)
    void overlayWindow.loadURL(overlayUrl.toString())
  } else {
    void overlayWindow.loadFile(join(currentDirectory, '../renderer/overlay.html'))
  }

  screen.on('display-metrics-changed', updateOverlayBounds)
  overlayWindow.on('closed', () => {
    overlayWindow = null
    overlayReady = false
    overlayActive = false
    pendingOverlayAlert = null
    screen.removeListener('display-metrics-changed', updateOverlayBounds)
  })
}

function updateOverlayBounds(): void {
  if (!overlayWindow) return
  overlayWindow.setBounds(screen.getPrimaryDisplay().bounds)
}

app.whenReady().then(() => {
  ipcMain.handle('overlay:set-active', (event, active: unknown) => {
    assertMainWindowSender(event.sender)
    if (typeof active !== 'boolean') {
      throw new Error('Overlay active state must be a boolean.')
    }
    if (!overlayWindow) return
    overlayActive = active
    if (active) {
      updateOverlayBounds()
      if (overlayReady) {
        overlayWindow.showInactive()
        if (pendingOverlayAlert) {
          overlayWindow.webContents.send('overlay:alert', pendingOverlayAlert)
          pendingOverlayAlert = null
        }
      }
    } else {
      overlayWindow.hide()
    }
  })

  ipcMain.on('overlay:ready', (event) => {
    if (!overlayWindow || event.sender !== overlayWindow.webContents) {
      throw new Error('Overlay readiness can only be reported by the overlay window.')
    }
    overlayReady = true
    if (!overlayActive) return
    updateOverlayBounds()
    overlayWindow.showInactive()
    if (pendingOverlayAlert) {
      overlayWindow.webContents.send('overlay:alert', pendingOverlayAlert)
      pendingOverlayAlert = null
    }
  })

  ipcMain.on('overlay:publish-alert', (event, title: unknown) => {
    assertMainWindowSender(event.sender)
    if (typeof title !== 'string' || title.trim().length === 0 || title.length > 240) {
      throw new Error('Overlay alert text is invalid.')
    }
    if (!overlayWindow || !overlayReady) {
      pendingOverlayAlert = title
      return
    }
    overlayWindow.webContents.send('overlay:alert', title)
  })

  ipcMain.handle('game-ocr:initialize', async (event) => {
    assertMainWindowSender(event.sender)
    if (!ocrWorkerPromise) {
      ocrWorkerPromise = createWorker('eng', 1, {
        langPath: englishDataDirectory,
        gzip: true
      }).then(async (worker) => {
        ocrWorker = worker
        await worker.setParameters({
          tessedit_char_whitelist: '0123456789:',
          tessedit_pageseg_mode: PSM.SINGLE_BLOCK
        })
        return worker
      })
    }

    try {
      await ocrWorkerPromise
      return true
    } catch (error) {
      ocrWorkerPromise = null
      ocrWorker = null
      console.error('Could not initialize local game-clock OCR.', error)
      throw new Error('Não foi possível iniciar o OCR local do relógio.')
    }
  })

  ipcMain.handle('game-ocr:read-clock', async (event, image: unknown) => {
    assertMainWindowSender(event.sender)
    if (!(image instanceof Uint8Array) || image.byteLength === 0 || image.byteLength > 512_000) {
      throw new Error('Invalid game-clock image.')
    }
    if (!ocrWorker) throw new Error('The local OCR worker is not initialized.')
    return enqueueOcr(async () => {
      await ocrWorker!.setParameters({
        tessedit_char_whitelist: '0123456789:',
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK
      })
      const result = await ocrWorker!.recognize(Buffer.from(image))
      return { text: result.data.text, confidence: result.data.confidence }
    })
  })

  ipcMain.handle('game-ocr:stop', async (event) => {
    assertMainWindowSender(event.sender)
    if (ocrWorker) await ocrWorker.terminate()
    ocrWorker = null
    ocrWorkerPromise = null
  })

  ipcMain.handle('capture:list-league-windows', async (event) => {
    assertMainWindowSender(event.sender)
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 0, height: 0 }
    })
    return sources.filter(isLeagueWindow).map(({ id, name }) => ({ id, name }))
  })

  ipcMain.handle('capture:select-league-window', async (event, sourceId: unknown) => {
    assertMainWindowSender(event.sender)
    if (typeof sourceId !== 'string' || sourceId.length === 0) {
      throw new Error('Select a valid League of Legends window.')
    }

    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 0, height: 0 }
    })
    const source = sources.find(
      (candidate) => candidate.id === sourceId && isLeagueWindow(candidate)
    )
    if (!source) {
      authorizedCaptureSource = null
      throw new Error('The selected League of Legends window is no longer available.')
    }

    authorizedCaptureSource = source
    return true
  })

  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    const selectedSource = authorizedCaptureSource
    authorizedCaptureSource = null

    if (
      !selectedSource ||
      !mainWindow ||
      !request.userGesture ||
      request.frame !== mainWindow.webContents.mainFrame
    ) {
      callback(null)
      return
    }

    void desktopCapturer
      .getSources({ types: ['window'], thumbnailSize: { width: 0, height: 0 } })
      .then((sources) => {
        const currentSource = sources.find(
          (source) =>
            source.id === selectedSource.id &&
            source.name === selectedSource.name &&
            isLeagueWindow(source)
        )
        callback(currentSource ? { video: currentSource } : null)
      })
      .catch((error: unknown) => {
        console.error('Could not resolve the selected game window for capture.', error)
        callback(null)
      })
  })

  createWindow()
  createOverlayWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      createOverlayWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (ocrWorker) void ocrWorker.terminate()
  if (process.platform !== 'darwin') app.quit()
})
