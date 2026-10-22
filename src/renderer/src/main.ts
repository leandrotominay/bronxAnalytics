export {}

declare global {
  interface Window {
    companion: {
      version: string
      setOverlayActive: (active: boolean) => Promise<void>
      publishOverlayAlert: (title: string) => void
      onOverlayAlert: (callback: (title: string) => void) => () => void
      findLeagueWindows: () => Promise<Array<{ id: string; name: string }>>
      selectLeagueWindow: (sourceId: string) => Promise<boolean>
      initializeGameOcr: () => Promise<boolean>
      readGameClock: (image: Uint8Array) => Promise<{ text: string; confidence: number }>
      readScoreboard: (image: Uint8Array) => Promise<{ text: string; confidence: number }>
      stopGameOcr: () => Promise<void>
    }
  }
}

const eventList = document.querySelector<HTMLOListElement>('#event-list')
const startButton = document.querySelector<HTMLButtonElement>('#start-button')
const stopButton = document.querySelector<HTMLButtonElement>('#stop-button')
const screenCanvas = document.querySelector<HTMLCanvasElement>('#screen-canvas')
const status = document.querySelector<HTMLParagraphElement>('#status')

if (
  !eventList ||
  !startButton ||
  !stopButton ||
  !screenCanvas ||
  !status
) {
  throw new Error('Required companion UI elements were not found.')
}

const events = eventList
const screen = screenCanvas
const captureStatus = status
const startCaptureButton = startButton
const stopCaptureButton = stopButton
const context = screen.getContext('2d', { willReadFrequently: true })

if (!context) {
  throw new Error('Could not initialize the screen analysis canvas.')
}

const matcherContext = context
const clockCanvas = document.createElement('canvas')
clockCanvas.width = 640
clockCanvas.height = 240
const clockContext = clockCanvas.getContext('2d', { willReadFrequently: true })
const scoreboardCanvas = document.createElement('canvas')
scoreboardCanvas.width = 1200
scoreboardCanvas.height = 720
const scoreboardContext = scoreboardCanvas.getContext('2d', { willReadFrequently: true })
if (!clockContext || !scoreboardContext) {
  throw new Error('Could not initialize the game HUD analysis canvases.')
}
const clockOcrContext = clockContext
const scoreboardOcrContext = scoreboardContext

type Point = { x: number; y: number }
type Region = { left: number; top: number; right: number; bottom: number }
type Lane = 'top' | 'mid' | 'bot'
type EnemyMarker = { center: Point; lane: Lane }
type LaneWatch = {
  hasBeenSeen: boolean
  lastVisibleCount: number
  missingSince: number | null
  alertCard: HTMLLIElement | null
  alerted: boolean
}

const minimumMarkerPixels = 3
const laneBoundary = 0.14
const laneCountDebounceFrames = 3
const missingAlertDelay = 5000
const voidGrubAlertTime = 5 * 60
const tabPromptTime = 10
let enemyMarkers: EnemyMarker[] = []
let stableLaneCounts: Record<Lane, number> | null = null
let pendingLaneCounts: Record<Lane, number> | null = null
let pendingLaneCountsSince = 0
let laneCountFrames = 0
const laneWatches: Record<Lane, LaneWatch> = {
  top: {
    hasBeenSeen: false,
    lastVisibleCount: 0,
    missingSince: null,
    alertCard: null,
    alerted: false
  },
  mid: {
    hasBeenSeen: false,
    lastVisibleCount: 0,
    missingSince: null,
    alertCard: null,
    alerted: false
  },
  bot: {
    hasBeenSeen: false,
    lastVisibleCount: 0,
    missingSince: null,
    alertCard: null,
    alerted: false
  }
}
let stream: MediaStream | null = null
let video: HTMLVideoElement | null = null
let region: Region | null = null
let timer: number | null = null
let selectedWindowId: string | null = null
let discoveryTimer: number | null = null
let discoveryInProgress = false
let clockTimer: number | null = null
let clockReadInProgress = false
let scoreboardReadInProgress = false
let clockReaderReady = false
let matchClockStarted = false
let tabPromptAnnounced = false
let scoreboardDetected = false
let voidGrubAlertAnnounced = false
let lastRecognizedClock: number | null = null
let stableClockCandidate: number | null = null
let stableClockSamples = 0
let lastClockSampleAt = 0
let scoreboardDetectionDeadline = 0
let lastScoreboardRead = 0

function announceEvent(titleText: string): HTMLLIElement {
  if (events.firstElementChild?.classList.contains('empty-state')) {
    events.replaceChildren()
  }

  const item = document.createElement('li')
  item.className = 'event-card'

  const title = document.createElement('strong')
  title.textContent = titleText

  const time = document.createElement('time')
  time.dateTime = new Date().toISOString()
  time.textContent = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  item.append(title, time)
  events.prepend(item)
  window.companion.publishOverlayAlert(titleText)

  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(titleText)
    utterance.lang = 'pt-BR'
    window.speechSynthesis.speak(utterance)
  }
  return item
}

function setStatus(message: string): void {
  captureStatus.textContent = message
}

function resetMatchEvents(): void {
  matchClockStarted = false
  tabPromptAnnounced = false
  scoreboardDetected = false
  voidGrubAlertAnnounced = false
  lastRecognizedClock = null
  stableClockCandidate = null
  stableClockSamples = 0
  lastClockSampleAt = 0
  scoreboardDetectionDeadline = 0
  lastScoreboardRead = 0
}

function parseGameClock(text: string): number | null {
  const match = text.replace(/\s/g, '').match(/^(\d{1,2}):([0-5]\d)$/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

async function canvasToBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result)
      else reject(new Error('Could not prepare a HUD crop for OCR.'))
    }, 'image/png')
  })
  return new Uint8Array(await blob.arrayBuffer())
}

async function readGameClock(): Promise<void> {
  if (
    !video ||
    !clockReaderReady ||
    clockReadInProgress ||
    scoreboardReadInProgress ||
    screen.width === 0
  ) return
  clockReadInProgress = true
  try {
    const left = Math.floor(screen.width * 0.955)
    const width = screen.width - left
    const height = Math.max(18, Math.floor(screen.height * 0.036))
    clockOcrContext.imageSmoothingEnabled = true
    clockOcrContext.imageSmoothingQuality = 'high'
    clockOcrContext.fillStyle = '#000'
    clockOcrContext.fillRect(0, 0, clockCanvas.width, clockCanvas.height)
    clockOcrContext.drawImage(
      screen,
      left,
      0,
      width,
      height,
      0,
      0,
      clockCanvas.width,
      clockCanvas.height
    )
    const clockPixels = clockOcrContext.getImageData(0, 0, clockCanvas.width, clockCanvas.height)
    for (let index = 0; index < clockPixels.data.length; index += 4) {
      const luminance =
        clockPixels.data[index] * 0.299 +
        clockPixels.data[index + 1] * 0.587 +
        clockPixels.data[index + 2] * 0.114
      const value = luminance > 90 ? 255 : 0
      clockPixels.data[index] = value
      clockPixels.data[index + 1] = value
      clockPixels.data[index + 2] = value
    }
    clockOcrContext.putImageData(clockPixels, 0, 0)

    const result = await window.companion.readGameClock(await canvasToBytes(clockCanvas))
    const seconds = parseGameClock(result.text)
    if (seconds === null || seconds > 99 * 60 + 59) {
      stableClockCandidate = null
      stableClockSamples = 0
      return
    }

    const now = Date.now()
    const elapsedAllowance =
      lastRecognizedClock === null
        ? 0
        : Math.ceil((now - lastClockSampleAt) / 1000) + 2
    if (
      lastRecognizedClock !== null &&
      (seconds < lastRecognizedClock || seconds - lastRecognizedClock > elapsedAllowance)
    ) {
      stableClockCandidate = seconds
      stableClockSamples = 1
      lastRecognizedClock = seconds
      lastClockSampleAt = now
      return
    }

    if (
      stableClockCandidate !== null &&
      seconds >= stableClockCandidate &&
      seconds - stableClockCandidate <= elapsedAllowance
    ) {
      stableClockSamples += 1
    } else {
      stableClockCandidate = seconds
      stableClockSamples = 1
    }
    lastRecognizedClock = seconds
    lastClockSampleAt = now
    if (stableClockSamples < 2) return

    if (!matchClockStarted) {
      if (seconds < 1) return
      matchClockStarted = true
      announceEvent('Relógio da partida detectado.')
    }

    if (!tabPromptAnnounced && seconds >= tabPromptTime) {
      tabPromptAnnounced = true
      scoreboardDetectionDeadline = Date.now() + 20_000
      announceEvent(
        'Aperte TAB e mantenha o placar aberto por 1 a 2 segundos para mapear as lanes e o jungler inimigo.'
      )
    }

    if (!voidGrubAlertAnnounced && seconds >= voidGrubAlertTime) {
      voidGrubAlertAnnounced = true
      announceEvent('As Vastilarvas nascem em 1 minuto.')
    }
  } catch (error) {
    console.error('Could not read the League of Legends game clock.', error)
    setStatus(
      error instanceof Error
        ? `Detecção ativa; leitura do relógio falhou: ${error.message}`
        : 'Detecção ativa; não foi possível ler o relógio.'
    )
  } finally {
    clockReadInProgress = false
  }
}

async function readScoreboard(): Promise<void> {
  const now = Date.now()
  if (
    !video ||
    !clockReaderReady ||
    !tabPromptAnnounced ||
    scoreboardDetected ||
    scoreboardReadInProgress ||
    now > scoreboardDetectionDeadline ||
    now - lastScoreboardRead < 1200
  ) {
    return
  }

  scoreboardReadInProgress = true
  lastScoreboardRead = now
  try {
    const left = Math.floor(screen.width * 0.08)
    const top = Math.floor(screen.height * 0.16)
    const width = Math.floor(screen.width * 0.84)
    const height = Math.floor(screen.height * 0.72)
    scoreboardOcrContext.imageSmoothingEnabled = false
    scoreboardOcrContext.fillStyle = '#000'
    scoreboardOcrContext.fillRect(0, 0, scoreboardCanvas.width, scoreboardCanvas.height)
    scoreboardOcrContext.drawImage(
      screen,
      left,
      top,
      width,
      height,
      0,
      0,
      scoreboardCanvas.width,
      scoreboardCanvas.height
    )

    const result = await window.companion.readScoreboard(
      await canvasToBytes(scoreboardCanvas)
    )
    const text = result.text.replace(/\s+/g, ' ')
    const kdaRows = text.match(/\b\d{1,3}\s*[/|]\s*\d{1,3}\s*[/|]\s*\d{1,3}\b/g)
    const scoreboardDigits = text.match(/\b\d{1,3}\b/g)
    if (result.confidence < 20 || (kdaRows?.length ?? 0) < 4 || (scoreboardDigits?.length ?? 0) < 20) {
      return
    }

    scoreboardDetected = true
    announceEvent(
      'Placar detectado. O OCR ainda não identifica campeões nem equipe; o mapeamento não foi confirmado.'
    )
  } catch (error) {
    console.error('Could not inspect the scoreboard with local OCR.', error)
    setStatus(
      error instanceof Error
        ? `Detecção ativa; leitura do placar falhou: ${error.message}`
        : 'Detecção ativa; não foi possível ler o placar.'
    )
  } finally {
    scoreboardReadInProgress = false
  }
}

function estimateMinimapRegion(): Region {
  const marginX = Math.max(4, Math.round(screen.width * 0.01))
  const marginY = Math.max(4, Math.round(screen.height * 0.01))
  const side = Math.round(Math.min(screen.width * 0.18, screen.height * 0.29))
  return {
    left: screen.width - marginX - side,
    top: screen.height - marginY - side,
    right: screen.width - marginX,
    bottom: screen.height - marginY
  }
}

function drawPreview(): void {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) return

  const scale = Math.min(1, 800 / video.videoWidth)
  const width = Math.round(video.videoWidth * scale)
  const height = Math.round(video.videoHeight * scale)
  if (screen.width !== width || screen.height !== height) {
    screen.width = width
    screen.height = height
  }

  matcherContext.drawImage(video, 0, 0, width, height)
}

function normalizedPoint(x: number, y: number): Point {
  if (!region) return { x: 0, y: 0 }
  return {
    x: (x - region.left) / (region.right - region.left),
    y: (y - region.top) / (region.bottom - region.top)
  }
}

function classifyLane(point: Point): Lane {
  const distanceToMid = Math.abs(point.x + point.y - 1) / Math.SQRT2
  if (distanceToMid <= laneBoundary) return 'mid'
  return point.y < 0.5 ? 'top' : 'bot'
}

function countMarkersByLane(markers: EnemyMarker[]): Record<Lane, number> {
  const counts: Record<Lane, number> = { top: 0, mid: 0, bot: 0 }
  for (const marker of markers) counts[marker.lane] += 1
  return counts
}

function detectEnemyMarkers(image: ImageData): EnemyMarker[] {
  if (!region) return []
  const width = image.width
  const height = image.height
  if (width <= 0 || height <= 0) return []

  const mask = new Uint8Array(width * height)
  const visited = new Uint8Array(mask.length)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const source = (y * image.width + x) * 4
      const red = image.data[source]
      const green = image.data[source + 1]
      const blue = image.data[source + 2]
      if (red >= 130 && red - green >= 45 && red - blue >= 35) {
        mask[y * width + x] = 1
      }
    }
  }

  const queue = new Int32Array(mask.length)
  const markers: EnemyMarker[] = []
  const maxMarkerSize = Math.max(10, Math.min(width, height) * 0.22)
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue
    let head = 0
    let tail = 0
    let pixels = 0
    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0
    queue[tail++] = start
    visited[start] = 1

    while (head < tail) {
      const index = queue[head++]
      const x = index % width
      const y = Math.floor(index / width)
      pixels += 1
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nextX = x + dx
          const nextY = y + dy
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue
          const next = nextY * width + nextX
          if (mask[next] && !visited[next]) {
            visited[next] = 1
            queue[tail++] = next
          }
        }
      }
    }

    const markerWidth = maxX - minX + 1
    const markerHeight = maxY - minY + 1
    const aspect = markerWidth / markerHeight
    if (
      pixels < minimumMarkerPixels ||
      markerWidth > maxMarkerSize ||
      markerHeight > maxMarkerSize ||
      aspect < 0.4 ||
      aspect > 2.5
    ) {
      continue
    }

    const center = normalizedPoint(
      region.left + (minX + maxX) / 2,
      region.top + (minY + maxY) / 2
    )
    markers.push({
      center,
      lane: classifyLane(center)
    })
  }
  return markers
}

function updateLaneCountAlerts(counts: Record<Lane, number>): void {
  if (
    !pendingLaneCounts ||
    pendingLaneCounts.top !== counts.top ||
    pendingLaneCounts.mid !== counts.mid ||
    pendingLaneCounts.bot !== counts.bot
  ) {
    pendingLaneCounts = counts
    pendingLaneCountsSince = Date.now()
    laneCountFrames = 1
  } else {
    laneCountFrames += 1
  }

  if (
    laneCountFrames >= laneCountDebounceFrames &&
    (!stableLaneCounts ||
      stableLaneCounts.top !== counts.top ||
      stableLaneCounts.mid !== counts.mid ||
      stableLaneCounts.bot !== counts.bot)
  ) {
    stableLaneCounts = counts
    for (const lane of ['top', 'mid', 'bot'] as const) {
      const watch = laneWatches[lane]
      if (counts[lane] > 0) {
        if (!watch.hasBeenSeen) {
          watch.hasBeenSeen = true
          watch.lastVisibleCount = counts[lane]
        } else if (counts[lane] >= watch.lastVisibleCount) {
          if (watch.missingSince !== null && watch.alerted && watch.alertCard) {
            const elapsed = Math.floor((Date.now() - watch.missingSince) / 1000)
            const title = watch.alertCard.querySelector('strong')
            if (title) {
              title.textContent = `${lane.toUpperCase()} laner inimigo reapareceu após ${formatElapsed(elapsed)}.`
            }
          }
          watch.lastVisibleCount = counts[lane]
          watch.missingSince = null
          watch.alerted = false
          watch.alertCard = null
        } else if (watch.missingSince === null) {
          watch.missingSince = pendingLaneCountsSince
        }
      } else if (watch.hasBeenSeen && watch.missingSince === null) {
        watch.missingSince = pendingLaneCountsSince
      }
    }
  }

  const now = Date.now()
  for (const lane of ['top', 'mid', 'bot'] as const) {
    const watch = laneWatches[lane]
    if (watch.missingSince === null) continue
    const elapsedMs = now - watch.missingSince
    if (elapsedMs > missingAlertDelay && !watch.alerted) {
      watch.alertCard = announceEvent(`${lane.toUpperCase()} laner inimigo desaparecido.`)
      watch.alerted = true
    }
    if (watch.alertCard && watch.alerted) {
      const title = watch.alertCard.querySelector('strong')
      if (title) {
        title.textContent =
          `${lane.toUpperCase()} laner inimigo desaparecido — há ${formatElapsed(Math.floor(elapsedMs / 1000))}.`
      }
    }
  }

  if (laneCountFrames >= laneCountDebounceFrames) {
    pendingLaneCounts = null
    laneCountFrames = 0
  }
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function analyzeFrame(): void {
  drawPreview()
  if (!region || screen.width === 0 || screen.height === 0) return

  const left = Math.max(0, Math.floor(region.left))
  const top = Math.max(0, Math.floor(region.top))
  const right = Math.min(screen.width, Math.ceil(region.right))
  const bottom = Math.min(screen.height, Math.ceil(region.bottom))
  enemyMarkers = detectEnemyMarkers(
    matcherContext.getImageData(left, top, right - left, bottom - top)
  )
  updateLaneCountAlerts(countMarkersByLane(enemyMarkers))
}

function stopCapture(): void {
  if (timer === null && stream === null) return
  if (timer !== null) {
    window.clearInterval(timer)
    timer = null
  }
  const activeStream = stream
  stream = null
  if (activeStream) {
    for (const track of activeStream.getTracks()) track.stop()
  }
  video = null
  region = null
  enemyMarkers = []
  stableLaneCounts = null
  pendingLaneCounts = null
  pendingLaneCountsSince = 0
  laneCountFrames = 0
  for (const lane of ['top', 'mid', 'bot'] as const) {
    laneWatches[lane] = {
      hasBeenSeen: false,
      lastVisibleCount: 0,
      missingSince: null,
      alertCard: null,
      alerted: false
    }
  }
  matcherContext.clearRect(0, 0, screen.width, screen.height)
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  void window.companion.setOverlayActive(false).catch((error: unknown) => {
    console.error('Could not hide the in-game alert overlay.', error)
    setStatus('Captura desligada, mas não foi possível ocultar o overlay.')
  })
  resetMatchEvents()
  if (clockReaderReady) {
    clockReaderReady = false
    void window.companion.stopGameOcr().catch((error: unknown) => {
      console.error('Could not stop local OCR worker.', error)
      setStatus('Captura desligada, mas o OCR local não encerrou corretamente.')
    })
  }
  if (clockTimer !== null) {
    window.clearInterval(clockTimer)
    clockTimer = null
  }
  stopCaptureButton.disabled = true
  startCaptureButton.disabled = selectedWindowId === null
  setStatus('Captura desligada.')
  if (selectedWindowId) void selectGameWindow(selectedWindowId)
}

async function discoverGameWindow(): Promise<void> {
  if (discoveryInProgress || selectedWindowId || stream) return
  discoveryInProgress = true
  startCaptureButton.disabled = true
  setStatus('Procurando uma janela aberta do League of Legends...')

  try {
    const windows = await window.companion.findLeagueWindows()
    if (windows.length === 0) {
      setStatus(
        'Ainda não encontrei a janela da partida. Vou procurar novamente automaticamente.'
      )
      if (discoveryTimer === null) {
        discoveryTimer = window.setInterval(() => {
          void discoverGameWindow()
        }, 4000)
      }
      return
    }

    if (discoveryTimer !== null) {
      window.clearInterval(discoveryTimer)
      discoveryTimer = null
    }
    const selected = await selectGameWindow(windows[0].id)
    if (selected) {
      setStatus(
        windows.length > 1
          ? `Encontrei ${windows.length} janelas correspondentes; selecionei a primeira. Pressione Start para iniciar.`
          : 'Jogo encontrado. Pressione Start para iniciar os alertas.'
      )
    }
  } catch (error) {
    setStatus(
      error instanceof Error
        ? `Não foi possível localizar o jogo: ${error.message}`
        : 'Não foi possível localizar a janela do jogo.'
    )
  } finally {
    discoveryInProgress = false
  }
}

async function selectGameWindow(sourceId: string): Promise<boolean> {
  selectedWindowId = null
  startCaptureButton.disabled = true
  if (!sourceId) return false

  try {
    await window.companion.selectLeagueWindow(sourceId)
    selectedWindowId = sourceId
    startCaptureButton.disabled = false
    return true
  } catch (error) {
    setStatus(
      error instanceof Error
        ? `Não foi possível selecionar essa janela: ${error.message}`
        : 'Não foi possível selecionar a janela do jogo.'
    )
    return false
  }
}

startCaptureButton.addEventListener('click', async () => {
  if (!selectedWindowId) {
    setStatus('Aguardando a janela do League of Legends...')
    return
  }

  if (!navigator.mediaDevices?.getDisplayMedia) {
    setStatus('Este ambiente não permite compartilhamento de tela.')
    return
  }

  startCaptureButton.disabled = true
  setStatus('Iniciando captura...')

  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 4 },
      audio: false
    })
    video = document.createElement('video')
    video.muted = true
    video.srcObject = stream
    await video.play()
    await window.companion.setOverlayActive(true)
    drawPreview()
    region = estimateMinimapRegion()
    resetMatchEvents()
    stream.getVideoTracks()[0]?.addEventListener('ended', stopCapture)
    stopCaptureButton.disabled = false
    timer = window.setInterval(analyzeFrame, 250)
    analyzeFrame()

    try {
      await window.companion.initializeGameOcr()
      if (!stream) return
      clockReaderReady = true
      setStatus('Detecção ativa; aguardando o relógio da partida.')
      clockTimer = window.setInterval(() => {
        void readGameClock()
        void readScoreboard()
      }, 750)
      void readGameClock()
    } catch (error) {
      console.error('Could not initialize the local OCR engine.', error)
      setStatus(
        error instanceof Error
          ? `Detecção visual ativa; leitura do relógio indisponível: ${error.message}`
          : 'Detecção visual ativa; leitura do relógio indisponível.'
      )
    }
  } catch (error) {
    if (stream) {
      for (const track of stream.getTracks()) track.stop()
      stream = null
    }
    video = null
    startCaptureButton.disabled = selectedWindowId === null
    if (error instanceof DOMException && error.name === 'NotSupportedError') {
      setStatus(
        'Esta prévia no navegador não suporta a captura configurada. Abra o companion pela janela Electron com npm run dev para capturar o jogo.'
      )
    } else {
      setStatus(
        error instanceof Error
          ? `Não foi possível capturar a janela: ${error.message}`
          : 'Não foi possível capturar a janela do jogo.'
      )
    }
    if (selectedWindowId) await selectGameWindow(selectedWindowId)
  }
})

stopCaptureButton.addEventListener('click', stopCapture)

void discoverGameWindow()
