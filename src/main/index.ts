/// <reference types="electron-vite/node" />

import {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  ipcMain,
  screen,
  session,
  type DesktopCapturerSource
} from 'electron'
import bronxAnalyticsIcon from '../../resources/bronx-analytics.ico?asset'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWorker, PSM } from 'tesseract.js'
import {
  isRiotPlatform,
  type RiotSyncRequest,
  type RiotSyncResponse
} from '../shared/riot-sync'
import type { OverlayMarker } from '../shared/overlay'
import { readLiveClientJungler } from './live-client-data'

declare const __BRONX_RIOT_SYNC_URL__: string

const currentDirectory = fileURLToPath(new URL('.', import.meta.url))
const require = createRequire(import.meta.url)
app.setName('Bronx I.A')
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
let pendingOverlayMarker: OverlayMarker | null = null
let hasPendingOverlayMarker = false
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

function isOverlayMarker(value: unknown): value is OverlayMarker {
  if (typeof value !== 'object' || value === null) return false
  const marker = value as Record<string, unknown>
  return (
    typeof marker.x === 'number' &&
    Number.isFinite(marker.x) &&
    marker.x >= 0 &&
    marker.x <= 1 &&
    typeof marker.y === 'number' &&
    Number.isFinite(marker.y) &&
    marker.y >= 0 &&
    marker.y <= 1 &&
    typeof marker.size === 'number' &&
    Number.isFinite(marker.size) &&
    marker.size > 0 &&
    marker.size <= 0.1
  )
}

function isRiotSyncRequest(value: unknown): value is RiotSyncRequest {
  if (typeof value !== 'object' || value === null) return false
  const request = value as Record<string, unknown>
  return (
    typeof request.gameName === 'string' &&
    request.gameName.trim().length > 0 &&
    request.gameName.length <= 16 &&
    !request.gameName.includes('#') &&
    typeof request.tagLine === 'string' &&
    request.tagLine.trim().length > 0 &&
    request.tagLine.length <= 8 &&
    !request.tagLine.includes('#') &&
    isRiotPlatform(request.platform)
  )
}

function validateRiotWorkerUrl(value: unknown): URL {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      'A sincronização não está configurada nesta versão do Bronx I.A'
    )
  }
  if (value.length > 240) {
    throw new Error('O endereço do serviço de sincronização é muito longo.')
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('O endereço do Cloudflare Worker não é válido.')
  }
  const isWorkersDev =
    url.protocol === 'https:' &&
    url.hostname.endsWith('.workers.dev') &&
    url.hostname !== 'workers.dev'
  const isLocalDevelopment =
    !app.isPackaged &&
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
    url.port.length > 0
  if (
    (!isWorkersDev && !isLocalDevelopment) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('Use a URL raiz de um Worker HTTPS em *.workers.dev.')
  }
  return url
}

function isRiotSyncResponse(value: unknown): value is RiotSyncResponse {
  if (typeof value !== 'object' || value === null) return false
  const response = value as Record<string, unknown>
  if (
    !Array.isArray(response.matches) ||
    response.matches.length > 20 ||
    !(
      response.nextStart === null ||
      (typeof response.nextStart === 'number' &&
        Number.isInteger(response.nextStart) &&
        response.nextStart >= 0 &&
        response.nextStart <= 100_000)
    ) ||
    typeof response.rankObservedAt !== 'number' ||
    !Number.isFinite(response.rankObservedAt) ||
    !Number.isFinite(new Date(response.rankObservedAt).getTime())
  ) {
    return false
  }
  if (
    response.matches.some((entry) => {
      if (typeof entry !== 'object' || entry === null) return true
      const match = entry as Record<string, unknown>
      if (typeof match.stats !== 'object' || match.stats === null) return true
      const stats = match.stats as Record<string, unknown>
      return (
        typeof match.matchId !== 'string' ||
        !/^[A-Za-z0-9_-]{1,64}$/.test(match.matchId) ||
        typeof match.startedAt !== 'number' ||
        !Number.isFinite(match.startedAt) ||
        !Number.isFinite(new Date(match.startedAt).getTime()) ||
        (match.result !== 'win' && match.result !== 'loss') ||
        typeof match.champion !== 'string' ||
        match.champion.length > 40 ||
        typeof match.durationSeconds !== 'number' ||
        !Number.isFinite(match.durationSeconds) ||
        match.durationSeconds < 0 ||
        match.durationSeconds > 24 * 60 * 60 ||
        typeof stats.kills !== 'number' ||
        !Number.isInteger(stats.kills) ||
        stats.kills < 0 ||
        typeof stats.deaths !== 'number' ||
        !Number.isInteger(stats.deaths) ||
        stats.deaths < 0 ||
        typeof stats.assists !== 'number' ||
        !Number.isInteger(stats.assists) ||
        stats.assists < 0 ||
        typeof stats.cs !== 'number' ||
        !Number.isInteger(stats.cs) ||
        stats.cs < 0 ||
        typeof stats.goldEarned !== 'number' ||
        !Number.isInteger(stats.goldEarned) ||
        stats.goldEarned < 0 ||
        typeof stats.damageToChampions !== 'number' ||
        !Number.isInteger(stats.damageToChampions) ||
        stats.damageToChampions < 0
      )
    })
  ) {
    return false
  }
  if (response.rank === null) return true
  if (typeof response.rank !== 'object' || response.rank === null) return false
  const rank = response.rank as Record<string, unknown>
  return (
    typeof rank.tier === 'string' &&
    rank.tier.length <= 20 &&
    typeof rank.division === 'string' &&
    rank.division.length <= 4 &&
    typeof rank.leaguePoints === 'number' &&
    Number.isInteger(rank.leaguePoints) &&
    rank.leaguePoints >= 0 &&
    rank.leaguePoints <= 100
  )
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 820,
    minWidth: 760,
    minHeight: 620,
    frame: false,
    autoHideMenuBar: true,
    title: 'Bronx I.A',
    icon: bronxAnalyticsIcon,
    backgroundColor: '#0d0d10',
    webPreferences: {
      preload: join(currentDirectory, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  mainWindow.removeMenu()

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
    pendingOverlayMarker = null
    hasPendingOverlayMarker = false
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
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
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
    pendingOverlayMarker = null
    hasPendingOverlayMarker = false
    screen.removeListener('display-metrics-changed', updateOverlayBounds)
  })
}

function updateOverlayBounds(): void {
  if (!overlayWindow) return
  overlayWindow.setBounds(screen.getPrimaryDisplay().bounds)
}

app.whenReady().then(() => {
  ipcMain.handle('window:minimize', (event) => {
    assertMainWindowSender(event.sender)
    if (!mainWindow) throw new Error('The companion window is not available.')
    mainWindow.minimize()
  })

  ipcMain.handle('window:toggle-maximize', (event) => {
    assertMainWindowSender(event.sender)
    if (!mainWindow) throw new Error('The companion window is not available.')
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
    return mainWindow.isMaximized()
  })

  ipcMain.handle('window:close', (event) => {
    assertMainWindowSender(event.sender)
    if (!mainWindow) throw new Error('The companion window is not available.')
    mainWindow.close()
  })

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
        if (hasPendingOverlayMarker) {
          overlayWindow.webContents.send('overlay:marker', pendingOverlayMarker)
          pendingOverlayMarker = null
          hasPendingOverlayMarker = false
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
    if (hasPendingOverlayMarker) {
      overlayWindow.webContents.send('overlay:marker', pendingOverlayMarker)
      pendingOverlayMarker = null
      hasPendingOverlayMarker = false
    }
  })

  ipcMain.handle('overlay:set-marker', (event, markerValue: unknown) => {
    assertMainWindowSender(event.sender)
    if (markerValue !== null && !isOverlayMarker(markerValue)) {
      throw new Error('Overlay marker coordinates are invalid.')
    }
    if (!overlayWindow || !overlayReady) {
      pendingOverlayMarker = markerValue
      hasPendingOverlayMarker = true
      return
    }
    overlayWindow.webContents.send('overlay:marker', markerValue)
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

  ipcMain.handle('live-client:read-jungler', (event) => {
    assertMainWindowSender(event.sender)
    return readLiveClientJungler()
  })

  ipcMain.handle(
    'riot:sync-ranked-matches',
    async (event, syncRequestValue: unknown) => {
      assertMainWindowSender(event.sender)
      const workerUrl = validateRiotWorkerUrl(
        __BRONX_RIOT_SYNC_URL__ ||
          (!app.isPackaged ? 'http://localhost:8787' : '')
      )
      if (!isRiotSyncRequest(syncRequestValue)) {
        throw new Error('Os dados de Riot ID ou região são inválidos.')
      }
      let response: Response
      try {
        response = await fetch(new URL('/api/v1/sync', workerUrl), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(syncRequestValue),
          signal: AbortSignal.timeout(60_000)
        })
      } catch (error) {
        throw new Error(
          error instanceof Error && error.name === 'TimeoutError'
            ? 'A sincronização excedeu o tempo limite.'
            : !app.isPackaged && !__BRONX_RIOT_SYNC_URL__
              ? 'Worker local indisponível. Inicie com npm run worker:dev e configure RIOT_API_KEY no arquivo workers/riot-sync/.dev.vars.'
              : 'Não foi possível conectar ao serviço de sincronização do Bronx.',
          { cause: error }
        )
      }
      const responseText = await response.text()
      if (responseText.length > 500_000) {
        throw new Error('A resposta de sincronização excede o tamanho permitido.')
      }
      let payload: unknown
      try {
        payload = JSON.parse(responseText) as unknown
      } catch (error) {
        throw new Error('O Cloudflare Worker retornou uma resposta inválida.', { cause: error })
      }
      if (!response.ok) {
        const message =
          typeof payload === 'object' &&
          payload !== null &&
          'error' in payload &&
          typeof payload.error === 'string'
            ? payload.error
            : `O Cloudflare Worker retornou HTTP ${response.status}.`
        throw new Error(message)
      }
      if (!isRiotSyncResponse(payload)) {
        throw new Error('O Cloudflare Worker retornou dados de partidas inválidos.')
      }
      return payload
    }
  )

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

  ipcMain.handle('diagnostics:save-sample', async (event, sample: unknown) => {
    assertMainWindowSender(event.sender)
    if (
      typeof sample !== 'object' ||
      sample === null ||
      !('manifest' in sample) ||
      !('images' in sample) ||
      typeof sample.manifest !== 'string' ||
      typeof sample.images !== 'object' ||
      sample.images === null ||
      sample.manifest.length > 1_000_000
    ) {
      throw new Error('Invalid visual diagnostic sample.')
    }
    const images = sample.images as Record<string, unknown>
    const entries = Object.entries(images)
    const totalEncodedBytes = entries.reduce(
      (total, [, data]) => total + (typeof data === 'string' ? data.length : 0),
      0
    )
    if (
      entries.length < 1 ||
      entries.length > 8 ||
      totalEncodedBytes > 60_000_000 ||
      entries.some(
        ([name, data]) =>
          !/^[a-z0-9-]+\.png$/i.test(name) ||
          typeof data !== 'string' ||
          data.length > 20_000_000 ||
          !data.startsWith('data:image/png;base64,')
      )
    ) {
      throw new Error('Diagnostic images are invalid or too large.')
    }

    const choice = await dialog.showOpenDialog(mainWindow!, {
      title: 'Escolha onde salvar a amostra de diagnóstico',
      properties: ['openDirectory', 'createDirectory']
    })
    if (choice.canceled || choice.filePaths.length === 0) return null

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const directory = join(choice.filePaths[0], `league-diagnostic-${timestamp}`)
    await mkdir(directory, { recursive: false })
    await writeFile(join(directory, 'manifest.json'), sample.manifest, {
      encoding: 'utf8',
      flag: 'wx'
    })
    for (const [name, data] of entries) {
      const base64 = (data as string).slice('data:image/png;base64,'.length)
      const buffer = Buffer.from(base64, 'base64')
      if (
        buffer.length === 0 ||
        buffer.length > 15_000_000 ||
        buffer[0] !== 0x89 ||
        buffer[1] !== 0x50 ||
        buffer[2] !== 0x4e ||
        buffer[3] !== 0x47
      ) {
        throw new Error(`Diagnostic image ${name} is not a valid PNG.`)
      }
      await writeFile(join(directory, name), buffer, { flag: 'wx' })
    }
    return directory
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
