/// <reference types="vite/client" />

import championCatalog from '../assets/champions.json'

export {}

declare global {
  interface Window {
    companion: {
      version: string
      setOverlayActive: (active: boolean) => Promise<void>
      publishOverlayAlert: (title: string) => void
      notifyOverlayReady: () => void
      onOverlayAlert: (callback: (title: string) => void) => () => void
      findLeagueWindows: () => Promise<Array<{ id: string; name: string }>>
      selectLeagueWindow: (sourceId: string) => Promise<boolean>
      initializeGameOcr: () => Promise<boolean>
      readGameClock: (image: Uint8Array) => Promise<{ text: string; confidence: number }>
      stopGameOcr: () => Promise<void>
    }
  }
}

const eventList = document.querySelector<HTMLOListElement>('#event-list')
const startButton = document.querySelector<HTMLButtonElement>('#start-button')
const stopButton = document.querySelector<HTMLButtonElement>('#stop-button')
const screenCanvas = document.querySelector<HTMLCanvasElement>('#screen-canvas')
const status = document.querySelector<HTMLParagraphElement>('#status')
const junglerCard = document.querySelector<HTMLElement>('#jungler-card')
const junglerPortraitImage = document.querySelector<HTMLImageElement>('#jungler-portrait')
const junglerLocationText = document.querySelector<HTMLElement>('#jungler-location')
const enemyRoster = document.querySelector<HTMLElement>('#enemy-roster')
const enemyPlayerList = document.querySelector<HTMLOListElement>('#enemy-player-list')
const calibratePortraitsButton = document.querySelector<HTMLButtonElement>(
  '#calibrate-portraits-button'
)
const portraitCalibrationDialog = document.querySelector<HTMLDialogElement>(
  '#portrait-calibration'
)
const calibrationPreview = document.querySelector<HTMLCanvasElement>('#calibration-preview')
const calibrationRowSelect = document.querySelector<HTMLSelectElement>('#calibration-row')
const calibrationSizeInput = document.querySelector<HTMLInputElement>('#calibration-size')
const resetCalibrationButton = document.querySelector<HTMLButtonElement>(
  '#reset-calibration-button'
)
const calibrationFeedback = document.querySelector<HTMLElement>('#calibration-feedback')
const calibrationResolution = document.querySelector<HTMLElement>('#calibration-resolution')

if (
  !eventList ||
  !startButton ||
  !stopButton ||
  !screenCanvas ||
  !status ||
  !junglerCard ||
  !junglerPortraitImage ||
  !junglerLocationText ||
  !enemyRoster ||
  !enemyPlayerList ||
  !calibratePortraitsButton ||
  !portraitCalibrationDialog ||
  !calibrationPreview ||
  !calibrationRowSelect ||
  !calibrationSizeInput ||
  !resetCalibrationButton ||
  !calibrationFeedback ||
  !calibrationResolution
) {
  throw new Error('Required companion UI elements were not found.')
}

const events = eventList
const screen = screenCanvas
const captureStatus = status
const startCaptureButton = startButton
const stopCaptureButton = stopButton
const jungleCard = junglerCard
const junglePortrait = junglerPortraitImage
const jungleLocation = junglerLocationText
const roster = enemyRoster
const playerList = enemyPlayerList
const calibrationCanvas = calibrationPreview
const calibrationDialog = portraitCalibrationDialog
const calibrationRowControl = calibrationRowSelect
const calibrationSizeControl = calibrationSizeInput
const calibrationFeedbackElement = calibrationFeedback
const calibrationResolutionElement = calibrationResolution
const calibrationContext = calibrationCanvas.getContext('2d')
if (!calibrationContext) throw new Error('Could not initialize portrait calibration preview.')
const calibrationPreviewContext = calibrationContext
const context = screen.getContext('2d', { willReadFrequently: true })

if (!context) {
  throw new Error('Could not initialize the screen analysis canvas.')
}

const matcherContext = context
const clockCanvas = document.createElement('canvas')
clockCanvas.width = 640
clockCanvas.height = 240
const clockContext = clockCanvas.getContext('2d', { willReadFrequently: true })
if (!clockContext) throw new Error('Could not initialize the game clock analysis canvas.')
const clockOcrContext = clockContext
const scoreboardDetectionCanvas = document.createElement('canvas')
scoreboardDetectionCanvas.width = 480
scoreboardDetectionCanvas.height = 260
const scoreboardDetectionContext = scoreboardDetectionCanvas.getContext('2d', {
  willReadFrequently: true
})
const portraitCanvas = document.createElement('canvas')
portraitCanvas.width = 48
portraitCanvas.height = 48
const portraitContext = portraitCanvas.getContext('2d', { willReadFrequently: true })
const minimapCanvas = document.createElement('canvas')
minimapCanvas.width = 192
minimapCanvas.height = 192
const minimapContext = minimapCanvas.getContext('2d', { willReadFrequently: true })
const championSampleCanvas = document.createElement('canvas')
championSampleCanvas.width = 32
championSampleCanvas.height = 32
const championSampleContext = championSampleCanvas.getContext('2d', { willReadFrequently: true })
if (
  !scoreboardDetectionContext ||
  !portraitContext ||
  !minimapContext ||
  !championSampleContext
) {
  throw new Error('Could not initialize jungler visual analysis canvases.')
}
const championImageUrls = import.meta.glob<string>('../assets/champions/*.png', {
  eager: true,
  import: 'default',
  query: '?url'
})

type Point = { x: number; y: number }
type Region = { left: number; top: number; right: number; bottom: number }
type Lane = 'top' | 'mid' | 'bot'
type TeamLane = 'top' | 'jungle' | 'mid' | 'adc' | 'support'
type JungleZone = 'top' | 'top-river' | 'mid' | 'bot-river' | 'bot'
type ChampionDefinition = { id: string; name: string }
type ChampionTemplate = ChampionDefinition & {
  url: string
  pixels: Uint8ClampedArray
}
type ChampionCrop = { x: number; y: number; size: number }
type MinimapCrop = { x: number; y: number; size: number }
type EnemyPlayer = {
  id: string
  lane: TeamLane
  championId: string | null
  championName: string | null
  portrait: ImageData | null
  portraitUrl: string | null
  championManuallySelected: boolean
  candidateChampionId: string | null
  candidatePortrait: ImageData | null
  candidateChampionScans: number
}
type ChampionMatch = {
  champion: ChampionTemplate
  portrait: ImageData
  score: number
  runnerUpScore: number
}
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
const missingLaneMinimapScanInterval = 1000
const laneDetectionStartTime = 80
const jungleScanInterval = 1000
const voidGrubAlertTime = 7 * 60
const voidGrubSpawnTime = 8 * 60
const minimapRingSamplePoints = [
  [0.5, 0.08],
  [0.92, 0.5],
  [0.5, 0.92],
  [0.08, 0.5],
  [0.2, 0.2],
  [0.8, 0.2],
  [0.2, 0.8],
  [0.8, 0.8]
]
const jungleMatchMaximumScore = 0.13
const jungleMatchMinimumMargin = 0.02
const jungleMatchMinimumRingSamples = 4
const junglePositionStabilityRadius = 0.04
const scoreboardOpenConfirmationScans = 2
const scoreboardCloseConfirmationScans = 2
const enemyTeamRecognitionInterval = 250
const championIdentificationConfirmationScans = 3
const scoreboardRowCenters = [0.33, 0.41, 0.49, 0.57, 0.65]
const teamLaneOrder: TeamLane[] = ['top', 'jungle', 'mid', 'adc', 'support']
const championIdentificationThreshold = 0.2
const championIdentificationMargin = 0.015
const championLibrarySampleSide = 32
const championCropStorageKey = 'league-event-companion.champion-crops.v2'
const legacyChampionCropStorageKey = 'league-event-companion.champion-crops.v1'
const minimapCropStorageKey = 'league-event-companion.minimap-crops.v1'
const teamLaneLabels: Record<TeamLane, string> = {
  top: 'TOP',
  jungle: 'JUNGLE',
  mid: 'MID',
  adc: 'ADC',
  support: 'SUPORTE'
}
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
const jungleZoneMessages: Record<JungleZone, string> = {
  top: 'Jungler no top.',
  'top-river': 'Jungler no rio perto das Vastilarvas.',
  mid: 'Jungler no mid.',
  'bot-river': 'Jungler no rio perto do drag.',
  bot: 'Jungler no bot.'
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
let clockReaderReady = false
let laneDetectionEnabled = false
let tabPromptAnnounced = false
let voidGrubAlertAnnounced = false
let lastRecognizedClock: number | null = null
let stableClockCandidate: number | null = null
let stableClockSamples = 0
let lastClockSampleAt = 0
let junglePortraitTemplate: ImageData | null = null
let scoreboardOpenScans = 0
let scoreboardCloseScans = 0
let scoreboardVisible = false
let enemyTeamScanInProgress = false
let lastEnemyTeamScanAt = 0
let lastJungleScanAt = 0
let jungleScanInProgress = false
let pendingJungleZone: JungleZone | null = null
let pendingJungleZoneScans = 0
let pendingJunglePoint: Point | null = null
let announcedJungleZone: JungleZone | null = null
let lastConfirmedJungleZone: JungleZone | null = null
let jungleMissedScans = 0
let championTemplates: ChampionTemplate[] | null = null
let championTemplatesPromise: Promise<ChampionTemplate[]> | null = null
let enemyPlayers: EnemyPlayer[] = []
let draggedEnemyPlayerId: string | null = null
let jungleCaptureAnnounced = false
let activeJunglerPlayerId: string | null = null
let enemyDetectionAnnounced = false
let lastMissingLaneMinimapScanAt = 0
let calibrationDragRow: number | null = null
let calibrationDragOffset: Point = { x: 0, y: 0 }
let championCropPositions = defaultChampionCropPositions()
let activeChampionCropProfile = ''
let minimapCrop = defaultMinimapCrop()

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
  laneDetectionEnabled = false
  tabPromptAnnounced = false
  voidGrubAlertAnnounced = false
  lastRecognizedClock = null
  stableClockCandidate = null
  stableClockSamples = 0
  lastClockSampleAt = 0
  junglePortraitTemplate = null
  scoreboardOpenScans = 0
  scoreboardCloseScans = 0
  scoreboardVisible = false
  enemyTeamScanInProgress = false
  lastEnemyTeamScanAt = 0
  enemyDetectionAnnounced = false
  lastMissingLaneMinimapScanAt = 0
  lastJungleScanAt = 0
  pendingJungleZone = null
  pendingJungleZoneScans = 0
  pendingJunglePoint = null
  announcedJungleZone = null
  lastConfirmedJungleZone = null
  jungleMissedScans = 0
  enemyPlayers = []
  jungleCaptureAnnounced = false
  activeJunglerPlayerId = null
  roster.hidden = true
  playerList.replaceChildren()
  jungleCard.hidden = true
  junglePortrait.removeAttribute('src')
  jungleLocation.textContent = 'Aguardando o retrato no placar TAB.'
}

function parseGameClock(text: string): number | null {
  const match = text.replace(/\s/g, '').match(/^(\d{1,2}):([0-5]\d)$/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function drawCircularCrop(
  target: CanvasRenderingContext2D,
  image: CanvasImageSource,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number
): void {
  target.clearRect(0, 0, width, height)
  target.save()
  target.beginPath()
  target.arc(width / 2, height / 2, Math.min(width, height) / 2, 0, Math.PI * 2)
  target.clip()
  target.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height
  )
  target.restore()
}

async function readEnemyTeam(): Promise<void> {
  if (!scoreboardVisible || !video || video.videoWidth === 0 || video.videoHeight === 0) return

  const templates = await loadChampionLibrary()
  const diagnostics: string[] = []
  for (let index = 0; index < scoreboardRowCenters.length; index += 1) {
    if (!scoreboardVisible || !video) return
    const player = enemyPlayers.find((entry) => entry.id === `enemy-player-${index}`)
    if (!player || player.championManuallySelected) continue
    if (player.championId) {
      player.championId = null
      player.championName = null
      player.portrait = null
      player.portraitUrl = null
      renderEnemyRoster()
    }
    const match = identifyChampionInRow(index, templates)
    const previousCandidate = player.candidateChampionId
    const previousCandidateScans = player.candidateChampionScans
    if (!match) {
      player.candidateChampionId = null
      player.candidatePortrait = null
      player.candidateChampionScans = 0
      if (previousCandidate) renderEnemyRoster()
      continue
    }
    const margin = match.runnerUpScore - match.score
    const accepted =
      match.score <= championIdentificationThreshold &&
      margin >= championIdentificationMargin
    diagnostics.push(
      `Linha ${index + 1}: ${match.champion.name} (erro ${match.score.toFixed(3)}, margem ${margin.toFixed(3)})${accepted ? '' : ' — ajuste o recorte'}`
    )
    if (!accepted) {
      player.candidateChampionId = null
      player.candidatePortrait = null
      player.candidateChampionScans = 0
      if (previousCandidate) renderEnemyRoster()
      continue
    }
    const duplicateOwner = enemyPlayers.find(
      (entry) =>
        entry.id !== player.id &&
        entry.championManuallySelected &&
        entry.championId === match.champion.id
    )
    if (duplicateOwner) {
      player.candidateChampionId = null
      player.candidatePortrait = null
      player.candidateChampionScans = 0
      if (previousCandidate) renderEnemyRoster()
      continue
    }
    if (player.candidateChampionId === match.champion.id) {
      player.candidateChampionScans += 1
    } else {
      player.candidateChampionId = match.champion.id
      player.candidateChampionScans = 1
    }
    player.candidatePortrait = match.portrait
    if (player.candidateChampionScans < championIdentificationConfirmationScans) continue

    if (previousCandidate !== player.candidateChampionId ||
      previousCandidateScans < championIdentificationConfirmationScans) {
      renderEnemyRoster()
    }
  }
  if (calibrationDialog.open && diagnostics.length > 0) {
    calibrationFeedbackElement.textContent = diagnostics.join(' • ')
  }
  updateJunglePortrait()
}

function isScoreboardVisible(): boolean {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) return false
  scoreboardDetectionContext!.drawImage(
    video,
    video.videoWidth * 0.2,
    video.videoHeight * 0.18,
    video.videoWidth * 0.6,
    video.videoHeight * 0.52,
    0,
    0,
    scoreboardDetectionCanvas.width,
    scoreboardDetectionCanvas.height
  )
  const panel = scoreboardDetectionContext!.getImageData(
    0,
    0,
    scoreboardDetectionCanvas.width,
    scoreboardDetectionCanvas.height
  )
  let goldPixels = 0
  let sampleCount = 0
  for (let y = 0; y < panel.height; y += 2) {
    for (let x = 0; x < panel.width; x += 2) {
      const index = (y * panel.width + x) * 4
      const red = panel.data[index]
      const green = panel.data[index + 1]
      const blue = panel.data[index + 2]
      if (
        red > 110 &&
        green > 75 &&
        blue < 110 &&
        red > green * 1.1 &&
        green > blue * 1.15
      ) {
        goldPixels += 1
      }
      sampleCount += 1
    }
  }
  return goldPixels / sampleCount >= 0.017
}

function initializeEnemyRoster(): void {
  if (enemyPlayers.length > 0) return
  enemyPlayers = teamLaneOrder.map((lane, index) => ({
    id: `enemy-player-${index}`,
    lane,
    championId: null,
    championName: null,
    portrait: null,
    portraitUrl: null,
    championManuallySelected: false,
    candidateChampionId: null,
    candidatePortrait: null,
    candidateChampionScans: 0
  }))
  roster.hidden = false
  renderEnemyRoster()
}

function updateScoreboardDetection(): void {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) return

  if (isScoreboardVisible()) {
    scoreboardCloseScans = 0
    scoreboardOpenScans += 1
    if (!scoreboardVisible && scoreboardOpenScans >= scoreboardOpenConfirmationScans) {
      scoreboardVisible = true
      initializeEnemyRoster()
      if (!enemyDetectionAnnounced) {
        enemyDetectionAnnounced = true
        announceEvent('Inimigos detectados com sucesso.')
      }
      lastEnemyTeamScanAt = 0
    }
  } else {
    scoreboardOpenScans = 0
    scoreboardCloseScans += 1
    if (scoreboardCloseScans >= scoreboardCloseConfirmationScans) scoreboardVisible = false
  }

  if (
    !scoreboardVisible ||
    enemyTeamScanInProgress ||
    Date.now() - lastEnemyTeamScanAt < enemyTeamRecognitionInterval
  ) {
    return
  }
  enemyTeamScanInProgress = true
  lastEnemyTeamScanAt = Date.now()
  void readEnemyTeam()
    .catch((error: unknown) => {
      console.error('Could not identify enemy champions from the TAB scoreboard.', error)
      setStatus(
        error instanceof Error
          ? `Inimigos detectados; identificação visual falhou: ${error.message}`
          : 'Inimigos detectados; não foi possível identificar os campeões.'
      )
    })
    .finally(() => {
      enemyTeamScanInProgress = false
    })
}

async function loadChampionLibrary(): Promise<ChampionTemplate[]> {
  if (championTemplates) return championTemplates
  if (championTemplatesPromise) return championTemplatesPromise

  const definitions = championCatalog.champions as ChampionDefinition[]
  championTemplatesPromise = Promise.all(
    definitions.map(async (champion) => {
      const url = championImageUrls[`../assets/champions/${champion.id}.png`]
      if (!url) throw new Error(`Missing local Data Dragon portrait for ${champion.id}.`)
      const image = new Image()
      image.src = url
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = championLibrarySampleSide
      canvas.height = championLibrarySampleSide
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Could not create a canvas for champion image matching.')
      drawCircularCrop(
        context,
        image,
        0,
        0,
        image.naturalWidth,
        image.naturalHeight,
        championLibrarySampleSide,
        championLibrarySampleSide
      )
      return {
        ...champion,
        url,
        pixels: context.getImageData(
          0,
          0,
          championLibrarySampleSide,
          championLibrarySampleSide
        ).data
      }
    })
  )
  try {
    championTemplates = await championTemplatesPromise
    return championTemplates
  } catch (error) {
    championTemplatesPromise = null
    throw error
  }
}

function identifyChampionInRow(
  rowIndex: number,
  templates: ChampionTemplate[]
): ChampionMatch | null {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null
  const crop = championCropPositions[rowIndex]
  if (!crop) return null
  const size = Math.round(video.videoWidth * crop.size)
  const left = Math.round(video.videoWidth * crop.x - size / 2)
  const top = Math.round(video.videoHeight * crop.y - size / 2)
  if (
    size <= 0 ||
    left < 0 ||
    top < 0 ||
    left + size > video.videoWidth ||
    top + size > video.videoHeight
  ) {
    return null
  }
  championSampleContext!.clearRect(
    0,
    0,
    championLibrarySampleSide,
    championLibrarySampleSide
  )
  drawCircularCrop(
    championSampleContext!,
    video,
    left,
    top,
    size,
    size,
    championLibrarySampleSide,
    championLibrarySampleSide
  )
  const candidate = championSampleContext!.getImageData(
    0,
    0,
    championLibrarySampleSide,
    championLibrarySampleSide
  ).data
  const ranked = templates
    .map((champion) => ({
      champion,
      score: compareChampionSamples(champion.pixels, candidate),
      left,
      top,
      size
    }))
    .sort((first, second) => first.score - second.score)
  const best = ranked[0]
  const runnerUp = ranked[1]
  if (!best || !runnerUp) return null

  portraitContext!.imageSmoothingEnabled = true
  portraitContext!.imageSmoothingQuality = 'high'
  drawCircularCrop(
    portraitContext!,
    video,
    best.left,
    best.top,
    best.size,
    best.size,
    portraitCanvas.width,
    portraitCanvas.height
  )
  return {
    champion: best.champion,
    portrait: portraitContext!.getImageData(0, 0, portraitCanvas.width, portraitCanvas.height),
    score: best.score,
    runnerUpScore: runnerUp.score
  }
}

function compareChampionSamples(
  first: Uint8ClampedArray,
  second: Uint8ClampedArray
): number {
  const channelMeans = (pixels: Uint8ClampedArray): [number, number, number] => {
    const means: [number, number, number] = [0, 0, 0]
    for (let index = 0; index < pixels.length; index += 4) {
      means[0] += pixels[index]
      means[1] += pixels[index + 1]
      means[2] += pixels[index + 2]
    }
    const sampleCount = pixels.length / 4
    return [means[0] / sampleCount, means[1] / sampleCount, means[2] / sampleCount]
  }
  const firstMeans = channelMeans(first)
  const secondMeans = channelMeans(second)
  let difference = 0
  let count = 0
  for (let index = 0; index < first.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      difference += Math.abs(
        first[index + channel] -
          firstMeans[channel] -
          (second[index + channel] - secondMeans[channel])
      )
      count += 1
    }
  }
  return difference / (count * 255)
}

function renderEnemyRoster(): void {
  const players = [...enemyPlayers].sort(
    (first, second) => teamLaneOrder.indexOf(first.lane) - teamLaneOrder.indexOf(second.lane)
  )
  const fragment = document.createDocumentFragment()
  for (const player of players) {
    const item = document.createElement('li')
    item.className = 'enemy-player'
    item.draggable = true
    item.dataset.playerId = player.id

    const portrait = document.createElement('img')
    portrait.alt = player.championName
      ? `Retrato de ${player.championName}`
      : 'Retrato ainda oculto'
    portrait.src = player.portraitUrl ?? ''
    portrait.hidden = player.portraitUrl === null

    const placeholder = document.createElement('span')
    placeholder.className = 'player-portrait-placeholder'
    placeholder.textContent = '?'
    placeholder.hidden = player.portraitUrl !== null

    const details = document.createElement('div')
    details.className = 'enemy-player-details'

    const champion = document.createElement('select')
    champion.className = 'enemy-player-champion'
    champion.setAttribute('aria-label', `Campeão de ${teamLaneLabels[player.lane]}`)
    const unknownChampion = document.createElement('option')
    unknownChampion.value = ''
    unknownChampion.textContent = 'Campeão não identificado'
    champion.append(unknownChampion)
    for (const definition of championCatalog.champions as ChampionDefinition[]) {
      const option = document.createElement('option')
      option.value = definition.id
      option.textContent = definition.name
      option.selected = definition.id === player.championId
      champion.append(option)
    }
    champion.addEventListener('change', () => {
      void assignPlayerChampion(player, champion.value)
    })

    const lane = document.createElement('select')
    lane.className = 'enemy-player-lane'
    lane.setAttribute('aria-label', `Posição de ${player.championName ?? 'campeão não identificado'}`)
    for (const optionLane of teamLaneOrder) {
      const option = document.createElement('option')
      option.value = optionLane
      option.textContent = teamLaneLabels[optionLane]
      option.selected = optionLane === player.lane
      lane.append(option)
    }
    lane.addEventListener('change', () => {
      const selectedLane = teamLaneOrder.find((optionLane) => optionLane === lane.value)
      if (selectedLane) assignPlayerLane(player, selectedLane)
    })

    details.append(champion, lane)
    if (
      !player.championId &&
      player.candidateChampionId &&
      player.candidateChampionScans >= championIdentificationConfirmationScans
    ) {
      const suggestion = document.createElement('button')
      suggestion.type = 'button'
      suggestion.className = 'enemy-player-suggestion'
      suggestion.textContent = `Sugestão visual: ${player.candidateChampionId} — confirmar`
      suggestion.addEventListener('click', () => {
        void assignPlayerChampion(player, player.candidateChampionId ?? '')
      })
      details.append(suggestion)
    }
    item.append(portrait, placeholder, details)
    fragment.append(item)
  }
  playerList.replaceChildren(fragment)
}

async function assignPlayerChampion(player: EnemyPlayer, championId: string): Promise<void> {
  if (!championId) {
    player.championId = null
    player.championName = null
    player.portrait = null
    player.portraitUrl = null
    player.championManuallySelected = false
    player.candidateChampionId = null
    player.candidatePortrait = null
    player.candidateChampionScans = 0
    updateJunglePortrait()
    renderEnemyRoster()
    return
  }

  try {
    if (
      enemyPlayers.some(
        (entry) => entry.id !== player.id && entry.championId === championId
      )
    ) {
      throw new Error('Esse campeão já está atribuído a outra linha.')
    }
    const templates = await loadChampionLibrary()
    const selected = templates.find((champion) => champion.id === championId)
    if (!selected) throw new Error(`Champion ${championId} is not in the local catalog.`)
    const screenshotPortrait =
      player.candidateChampionId === selected.id ? player.candidatePortrait : null
    if (!screenshotPortrait) {
      const image = new Image()
      image.src = selected.url
      await image.decode()
      drawCircularCrop(
        portraitContext!,
        image,
        0,
        0,
        image.naturalWidth,
        image.naturalHeight,
        portraitCanvas.width,
        portraitCanvas.height
      )
    }
    player.championId = selected.id
    player.championName = selected.name
    player.portraitUrl = selected.url
    player.championManuallySelected = true
    player.candidateChampionId = null
    player.candidatePortrait = null
    player.candidateChampionScans = 0
    player.portrait = screenshotPortrait ??
      portraitContext!.getImageData(0, 0, portraitCanvas.width, portraitCanvas.height)
    updateJunglePortrait()
    renderEnemyRoster()
  } catch (error) {
    console.error('Could not set the manually selected champion.', error)
    setStatus(
      error instanceof Error
        ? `Não foi possível selecionar o campeão: ${error.message}`
        : 'Não foi possível selecionar o campeão.'
    )
  }
}

function assignPlayerLane(player: EnemyPlayer, lane: TeamLane): void {
  if (player.lane === lane) return
  const displacedPlayer = enemyPlayers.find((entry) => entry.lane === lane)
  if (displacedPlayer) displacedPlayer.lane = player.lane
  player.lane = lane
  updateJunglePortrait()
  renderEnemyRoster()
}

function updateJunglePortrait(): void {
  const jungler = enemyPlayers.find((player) => player.lane === 'jungle')
  if (activeJunglerPlayerId === jungler?.id && junglePortraitTemplate === (jungler?.portrait ?? null)) {
    return
  }
  activeJunglerPlayerId = jungler?.id ?? null
  jungleCaptureAnnounced = false
  junglePortraitTemplate = jungler?.portrait ?? null
  if (!jungler?.portrait || !jungler.portraitUrl) {
    jungleCard.hidden = true
    jungleCaptureAnnounced = false
    return
  }
  jungleCard.hidden = false
  junglePortrait.src = jungler.portraitUrl
  jungleLocation.textContent = 'Retrato do jungler capturado; procurando no minimapa.'
  pendingJungleZone = null
  pendingJungleZoneScans = 0
  pendingJunglePoint = null
  announcedJungleZone = null
  lastConfirmedJungleZone = null
  jungleMissedScans = 0
  if (!jungleCaptureAnnounced) {
    jungleCaptureAnnounced = true
    announceEvent('Captura do jungler feita com sucesso.')
  }
}

playerList.addEventListener('dragstart', (event) => {
  const item = (event.target as HTMLElement).closest<HTMLLIElement>('.enemy-player')
  draggedEnemyPlayerId = item?.dataset.playerId ?? null
  if (event.dataTransfer && draggedEnemyPlayerId) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', draggedEnemyPlayerId)
  }
})

playerList.addEventListener('dragover', (event) => {
  if ((event.target as HTMLElement).closest('.enemy-player')) event.preventDefault()
})

playerList.addEventListener('drop', (event) => {
  const targetItem = (event.target as HTMLElement).closest<HTMLLIElement>('.enemy-player')
  const targetPlayer = enemyPlayers.find((player) => player.id === targetItem?.dataset.playerId)
  const sourcePlayer = enemyPlayers.find(
    (player) => player.id === (event.dataTransfer?.getData('text/plain') || draggedEnemyPlayerId)
  )
  if (!targetPlayer || !sourcePlayer || targetPlayer === sourcePlayer) return
  event.preventDefault()
  const targetLane = targetPlayer.lane
  targetPlayer.lane = sourcePlayer.lane
  sourcePlayer.lane = targetLane
  draggedEnemyPlayerId = null
  updateJunglePortrait()
  renderEnemyRoster()
})

playerList.addEventListener('dragend', () => {
  draggedEnemyPlayerId = null
})

function classifyJungleZone(point: Point): JungleZone | null {
  const distanceToMid = Math.abs(point.x + point.y - 1) / Math.SQRT2
  if (distanceToMid <= 0.07) return 'mid'

  if (point.y < 0.22 || point.x < 0.22) return 'top'
  if (point.y > 0.78 || (point.x > 0.78 && point.y > 0.55)) return 'bot'

  return point.x + point.y < 1 ? 'top-river' : 'bot-river'
}

function findPortraitOnMinimap(template: ImageData): Point | null {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null

  const minimap = estimateJunglerMapBounds(video.videoWidth, video.videoHeight)
  const width = Math.ceil(minimap.right - minimap.left)
  const height = Math.ceil(minimap.bottom - minimap.top)
  minimapCanvas.width = width
  minimapCanvas.height = height
  minimapContext!.drawImage(
    video,
    minimap.left,
    minimap.top,
    width,
    height,
    0,
    0,
    width,
    height
  )
  const map = minimapContext!.getImageData(0, 0, width, height)
  const samplePoints: Array<{ x: number; y: number }> = []
  const sampleSide = 8
  for (let y = 0; y < sampleSide; y += 1) {
    for (let x = 0; x < sampleSide; x += 1) {
      samplePoints.push({
        x: 0.28 + 0.44 * (x + 0.5) / sampleSide,
        y: 0.28 + 0.44 * (y + 0.5) / sampleSide
      })
    }
  }

  const minIconSize = Math.max(8, Math.round(Math.min(width, height) * 0.04))
  const maxIconSize = Math.max(minIconSize, Math.round(Math.min(width, height) * 0.1))
  const iconSizeStep = Math.max(1, Math.round(Math.min(width, height) * 0.008))
  const candidates: Array<{ score: number; x: number; y: number; size: number }> = []
  for (let size = minIconSize; size <= maxIconSize; size += iconSizeStep) {
    for (let top = 0; top <= height - size; top += 2) {
      for (let left = 0; left <= width - size; left += 2) {
        let redRingSamples = 0
        for (const [xRatio, yRatio] of minimapRingSamplePoints) {
          const x = left + Math.round(size * xRatio)
          const y = top + Math.round(size * yRatio)
          const index = (y * width + x) * 4
          const red = map.data[index]
          if (
            red > 120 &&
            red > map.data[index + 1] * 1.25 &&
            red > map.data[index + 2] * 1.2
          ) {
            redRingSamples += 1
          }
        }
        if (redRingSamples < jungleMatchMinimumRingSamples) continue

        let error = 0
        for (const point of samplePoints) {
          const targetX = left + Math.round(size * point.x)
          const targetY = top + Math.round(size * point.y)
          const targetIndex = (targetY * width + targetX) * 4
          const templateX = Math.round(template.width * point.x)
          const templateY = Math.round(template.height * point.y)
          const templateIndex = (templateY * template.width + templateX) * 4
          error +=
            (Math.abs(map.data[targetIndex] - template.data[templateIndex]) +
              Math.abs(map.data[targetIndex + 1] - template.data[templateIndex + 1]) +
              Math.abs(map.data[targetIndex + 2] - template.data[templateIndex + 2])) /
            765
        }
        const score = error / samplePoints.length
        candidates.push({ score, x: left, y: top, size })
      }
    }
  }

  candidates.sort((first, second) => first.score - second.score)
  const best = candidates[0]
  if (!best || best.score > jungleMatchMaximumScore) return null

  const secondDistinctCandidate = candidates.find((candidate) => {
    const distance = Math.hypot(candidate.x - best.x, candidate.y - best.y)
    return distance >= Math.max(best.size, candidate.size)
  })
  if (
    secondDistinctCandidate &&
    secondDistinctCandidate.score - best.score < jungleMatchMinimumMargin
  ) {
    return null
  }

  const point = {
    x: (best.x + best.size / 2) / width,
    y: (best.y + best.size / 2) / height
  }
  return point
}

function findJunglerOnMinimap(): { zone: JungleZone; point: Point } | null {
  if (!junglePortraitTemplate) return null
  const point = findPortraitOnMinimap(junglePortraitTemplate)
  if (!point) return null
  const zone = classifyJungleZone(point)
  return zone ? { zone, point } : null
}

function refreshMissingLaneMinimapVisibility(
  counts: Record<Lane, number>,
  now: number
): void {
  if (
    !video ||
    Date.now() - lastMissingLaneMinimapScanAt < missingLaneMinimapScanInterval
  ) {
    return
  }
  lastMissingLaneMinimapScanAt = now
  for (const lane of ['top', 'mid', 'bot'] as const) {
    const watch = laneWatches[lane]
    if (!watch.hasBeenSeen) continue
    if (counts[lane] > 0 && watch.missingSince === null) continue
    const player = enemyPlayers.find(
      (entry) => entry.lane === lane && entry.portrait !== null
    )
    if (!player?.portrait) continue
    if (!findPortraitOnMinimap(player.portrait)) continue

    watch.missingSince = now
    if (watch.alerted && watch.alertCard) {
      const title = watch.alertCard.querySelector('strong')
      if (title) title.textContent = `${lane.toUpperCase()} laner inimigo visível no minimapa.`
      watch.alerted = false
      watch.alertCard = null
    }
  }
}

async function inspectJungler(): Promise<void> {
  if (!laneDetectionEnabled || jungleScanInProgress || Date.now() - lastJungleScanAt < jungleScanInterval) {
    return
  }
  jungleScanInProgress = true
  lastJungleScanAt = Date.now()
  try {
    if (!junglePortraitTemplate) return

    const match = findJunglerOnMinimap()
    if (!match) {
      jungleMissedScans += 1
      pendingJungleZone = null
      pendingJungleZoneScans = 0
      pendingJunglePoint = null
      if (jungleMissedScans >= 3) {
        announcedJungleZone = null
        jungleLocation.textContent = lastConfirmedJungleZone
          ? `Jungler não visível; última posição confirmada: ${jungleZoneMessages[lastConfirmedJungleZone]}`
          : 'Retrato pronto; jungler ainda não visível no minimapa.'
      }
      return
    }

    jungleMissedScans = 0
    const distanceFromPending = pendingJunglePoint
      ? Math.hypot(
          match.point.x - pendingJunglePoint.x,
          match.point.y - pendingJunglePoint.y
        )
      : Number.POSITIVE_INFINITY
    if (
      pendingJungleZone === match.zone &&
      distanceFromPending <= junglePositionStabilityRadius
    ) {
      pendingJungleZoneScans += 1
    } else {
      pendingJungleZone = match.zone
      pendingJungleZoneScans = 1
    }
    pendingJunglePoint = match.point
    if (pendingJungleZoneScans < 2) return

    const message = jungleZoneMessages[match.zone]
    jungleLocation.textContent = `Jungler visível: ${message}`
    if (announcedJungleZone === match.zone) return

    announcedJungleZone = match.zone
    lastConfirmedJungleZone = match.zone
    announceEvent(message)
  } catch (error) {
    console.error('Could not inspect the enemy jungler on the minimap.', error)
    setStatus(
      error instanceof Error
        ? `Detecção das lanes ativa; leitura do jungler falhou: ${error.message}`
        : 'Detecção das lanes ativa; não foi possível ler o jungler.'
    )
  } finally {
    jungleScanInProgress = false
  }
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
    video.videoWidth === 0 ||
    video.videoHeight === 0
  ) return
  clockReadInProgress = true
  try {
    const clockRegions = [
      { left: 0.96, width: 0.04, top: 0, height: 0.045, name: 'canto superior direito' },
      { left: 0.96, width: 0.04, top: 0.015, height: 0.045, name: 'HUD superior direito' }
    ] as const
    let seconds: number | null = null
    const readings: string[] = []

    for (const clockRegion of clockRegions) {
      const left = Math.floor(video.videoWidth * clockRegion.left)
      const width = Math.floor(video.videoWidth * clockRegion.width)
      const top = Math.floor(video.videoHeight * clockRegion.top)
      const height = Math.max(30, Math.floor(video.videoHeight * clockRegion.height))
      clockOcrContext.imageSmoothingEnabled = true
      clockOcrContext.imageSmoothingQuality = 'high'
      clockOcrContext.fillStyle = '#000'
      clockOcrContext.fillRect(0, 0, clockCanvas.width, clockCanvas.height)
      clockOcrContext.drawImage(
        video,
        left,
        top,
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
      const parsed = parseGameClock(result.text)
      readings.push(`${clockRegion.name}: ${result.text.trim() || 'sem leitura'}`)
      if (parsed !== null && parsed <= 99 * 60 + 59) {
        seconds = parsed
        break
      }
    }

    if (seconds === null || seconds > 99 * 60 + 59) {
      stableClockCandidate = null
      stableClockSamples = 0
      setStatus(`Não reconheci o cronômetro. ${readings.join(' | ')}`)
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

    if (!laneDetectionEnabled && seconds < laneDetectionStartTime) {
      setStatus(`Cronômetro ${formatElapsed(seconds)}; aguardando 01:20 para ativar as lanes.`)
    }

    if (!laneDetectionEnabled && seconds >= laneDetectionStartTime) {
      laneDetectionEnabled = true
      resetLaneTracking()
      setStatus(`Cronômetro ${formatElapsed(seconds)}; detecção automática das lanes ativa.`)
    }
    if (laneDetectionEnabled && !tabPromptAnnounced) {
      tabPromptAnnounced = true
      announceEvent('APERTE TAB PARA DETECTARMOS OS OPONENTES E SUAS LANES.')
    }

    if (!voidGrubAlertAnnounced && seconds >= voidGrubAlertTime) {
      voidGrubAlertAnnounced = true
      if (seconds < voidGrubSpawnTime) {
        const remainingSeconds = voidGrubSpawnTime - seconds
        const remainingTime =
          remainingSeconds === 60
            ? '1 minuto'
            : remainingSeconds < 60
              ? `${remainingSeconds} segundos`
              : `${Math.ceil(remainingSeconds / 60)} minutos`
        announceEvent(`As Vastilarvas nascem em ${remainingTime}.`)
      }
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

function estimateJunglerMapBounds(width: number, height: number): Region {
  const side = Math.round(width * minimapCrop.size)
  const centerX = width * minimapCrop.x
  const centerY = height * minimapCrop.y
  return {
    left: Math.max(0, Math.round(centerX - side / 2)),
    top: Math.max(0, Math.round(centerY - side / 2)),
    right: Math.min(width, Math.round(centerX + side / 2)),
    bottom: Math.min(height, Math.round(centerY + side / 2))
  }
}

function drawPreview(): void {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) return
  const captureProfile = `${video.videoWidth}x${video.videoHeight}`
  if (captureProfile !== activeChampionCropProfile) {
    activeChampionCropProfile = captureProfile
    championCropPositions = loadChampionCropPositions(video.videoWidth, video.videoHeight)
    if (calibrationDialog.open) selectCalibrationRow(Number(calibrationRowControl.value))
  }

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
      const player = enemyPlayers.find(
        (entry) => entry.lane === lane && entry.portrait !== null
      )
      if (!player) continue
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

function resetLaneTracking(): void {
  stableLaneCounts = null
  pendingLaneCounts = null
  pendingLaneCountsSince = 0
  laneCountFrames = 0
  enemyMarkers = []
  for (const lane of ['top', 'mid', 'bot'] as const) {
    laneWatches[lane] = {
      hasBeenSeen: false,
      lastVisibleCount: 0,
      missingSince: null,
      alertCard: null,
      alerted: false
    }
  }
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function defaultChampionCropPositions(): ChampionCrop[] {
  return scoreboardRowCenters.map((y) => ({ x: 0.543, y, size: 0.034 }))
}

function defaultMinimapCrop(width = 1920, height = 1080): MinimapCrop {
  const size = Math.min(0.13, (height * 0.235) / width)
  return {
    x: 1 - 0.008 - size / 2,
    y: 1 - 0.005 - (size * width) / (2 * height),
    size
  }
}

function parseChampionCropPositions(saved: string, defaults: ChampionCrop[]): ChampionCrop[] {
  const parsed: unknown = JSON.parse(saved)
  if (!Array.isArray(parsed) || parsed.length !== defaults.length) return defaults
  return parsed.map((value, index) => {
    if (
      typeof value !== 'object' ||
      value === null ||
      !('x' in value) ||
      !('y' in value) ||
      !('size' in value) ||
      typeof value.x !== 'number' ||
      typeof value.y !== 'number' ||
      typeof value.size !== 'number' ||
      !Number.isFinite(value.x) ||
      !Number.isFinite(value.y) ||
      !Number.isFinite(value.size)
    ) {
      return defaults[index]
    }
    return {
      x: Math.min(0.98, Math.max(0.02, value.x)),
      y: Math.min(0.98, Math.max(0.02, value.y)),
      size: Math.min(0.07, Math.max(0.02, value.size))
    }
  })
}

function loadChampionCropPositions(width: number, height: number): ChampionCrop[] {
  const defaults = defaultChampionCropPositions()
  activeChampionCropProfile = `${width}x${height}`
  const profileKey = `${championCropStorageKey}:${activeChampionCropProfile}`
  try {
    minimapCrop = loadMinimapCrop(width, height)
    const profile = localStorage.getItem(profileKey)
    if (profile) return parseChampionCropPositions(profile, defaults)

    const legacy = localStorage.getItem(legacyChampionCropStorageKey)
    if (!legacy) return defaults
    const migrated = parseChampionCropPositions(legacy, defaults)
    localStorage.setItem(profileKey, JSON.stringify(migrated))
    return migrated
  } catch (error) {
    console.error('Could not load saved portrait crop positions.', error)
    return defaults
  }
}

function loadMinimapCrop(width: number, height: number): MinimapCrop {
  const defaults = defaultMinimapCrop(width, height)
  const key = `${minimapCropStorageKey}:${width}x${height}`
  try {
    const saved = localStorage.getItem(key)
    if (!saved) return defaults
    const parsed: unknown = JSON.parse(saved)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('x' in parsed) ||
      !('y' in parsed) ||
      !('size' in parsed) ||
      typeof parsed.x !== 'number' ||
      typeof parsed.y !== 'number' ||
      typeof parsed.size !== 'number' ||
      !Number.isFinite(parsed.x) ||
      !Number.isFinite(parsed.y) ||
      !Number.isFinite(parsed.size)
    ) {
      return defaults
    }
    return {
      x: Math.min(0.99, Math.max(0.01, parsed.x)),
      y: Math.min(0.99, Math.max(0.01, parsed.y)),
      size: Math.min(0.3, Math.max(0.05, parsed.size))
    }
  } catch (error) {
    console.error('Could not load saved minimap crop.', error)
    return defaults
  }
}

function saveChampionCropPositions(): void {
  try {
    if (!activeChampionCropProfile) {
      throw new Error('No active capture resolution is available for the crop profile.')
    }
    localStorage.setItem(
      `${championCropStorageKey}:${activeChampionCropProfile}`,
      JSON.stringify(championCropPositions)
    )
  } catch (error) {
    console.error('Could not save portrait crop positions.', error)
    calibrationFeedbackElement.textContent =
      'Não foi possível salvar os ajustes. Eles valerão apenas até fechar o app.'
  }
}

function saveMinimapCrop(): void {
  try {
    if (!activeChampionCropProfile) {
      throw new Error('No active capture resolution is available for the minimap profile.')
    }
    localStorage.setItem(
      `${minimapCropStorageKey}:${activeChampionCropProfile}`,
      JSON.stringify(minimapCrop)
    )
  } catch (error) {
    console.error('Could not save minimap crop.', error)
    calibrationFeedbackElement.textContent =
      'Não foi possível salvar o minimapa. O ajuste valerá apenas até fechar o app.'
  }
}

function drawCalibrationPreview(): void {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
    calibrationFeedbackElement.textContent =
      'Inicie a captura e abra o TAB para ajustar os retratos.'
    calibrationResolutionElement.textContent = 'Perfil de captura: aguardando o jogo.'
    return
  }
  calibrationResolutionElement.textContent =
    `Captura: ${video.videoWidth}×${video.videoHeight} — ajustes salvos para esta resolução.`
  if (
    calibrationCanvas.width !== video.videoWidth ||
    calibrationCanvas.height !== video.videoHeight
  ) {
    calibrationCanvas.width = video.videoWidth
    calibrationCanvas.height = video.videoHeight
  }
  calibrationPreviewContext.drawImage(video, 0, 0)
  const selectedRow = Number(calibrationRowControl.value)
  for (let index = 0; index < championCropPositions.length; index += 1) {
    const crop = championCropPositions[index]
    const size = crop.size * video.videoWidth
    const left = crop.x * video.videoWidth - size / 2
    const top = crop.y * video.videoHeight - size / 2
    calibrationPreviewContext.strokeStyle = index === selectedRow ? '#ffffff' : '#c89b3c'
    calibrationPreviewContext.lineWidth = Math.max(2, video.videoWidth / 800)
    calibrationPreviewContext.beginPath()
    calibrationPreviewContext.arc(
      crop.x * video.videoWidth,
      crop.y * video.videoHeight,
      size / 2,
      0,
      Math.PI * 2
    )
    calibrationPreviewContext.stroke()
    calibrationPreviewContext.fillStyle = index === selectedRow ? '#ffffff' : '#c89b3c'
    calibrationPreviewContext.font = `bold ${Math.max(14, video.videoWidth / 80)}px sans-serif`
    calibrationPreviewContext.fillText(String(index + 1), left + 4, top - 5)
  }
  if (selectedRow === championCropPositions.length) {
    const mapSize = minimapCrop.size * video.videoWidth
    calibrationPreviewContext.strokeStyle = '#ffffff'
    calibrationPreviewContext.lineWidth = Math.max(2, video.videoWidth / 800)
    calibrationPreviewContext.strokeRect(
      minimapCrop.x * video.videoWidth - mapSize / 2,
      minimapCrop.y * video.videoHeight - mapSize / 2,
      mapSize,
      mapSize
    )
  }
}

function selectCalibrationRow(index: number): void {
  if (index === championCropPositions.length) {
    calibrationRowControl.value = String(index)
    calibrationSizeControl.min = '0.05'
    calibrationSizeControl.max = '0.3'
    calibrationSizeControl.step = '0.005'
    calibrationSizeControl.value = String(minimapCrop.size)
    calibrationFeedbackElement.textContent =
      'Arraste o quadrado para cobrir somente a área jogável do minimapa.'
    drawCalibrationPreview()
    return
  }
  const crop = championCropPositions[index]
  if (!crop) return
  calibrationRowControl.value = String(index)
  calibrationSizeControl.min = '0.02'
  calibrationSizeControl.max = '0.07'
  calibrationSizeControl.step = '0.001'
  calibrationSizeControl.value = String(crop.size)
  drawCalibrationPreview()
}

function clearAutomaticChampionDetection(index: number): void {
  const player = enemyPlayers.find((entry) => entry.id === `enemy-player-${index}`)
  if (!player || player.championManuallySelected) return
  player.championId = null
  player.championName = null
  player.portrait = null
  player.portraitUrl = null
  player.candidateChampionId = null
  player.candidatePortrait = null
  player.candidateChampionScans = 0
  updateJunglePortrait()
  renderEnemyRoster()
}

function calibrationPointFromEvent(event: PointerEvent): Point | null {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null
  const bounds = calibrationCanvas.getBoundingClientRect()
  if (bounds.width === 0 || bounds.height === 0) return null
  const scale = Math.min(
    bounds.width / video.videoWidth,
    bounds.height / video.videoHeight
  )
  const renderedWidth = video.videoWidth * scale
  const renderedHeight = video.videoHeight * scale
  const offsetX = (bounds.width - renderedWidth) / 2
  const offsetY = (bounds.height - renderedHeight) / 2
  const x = event.clientX - bounds.left - offsetX
  const y = event.clientY - bounds.top - offsetY
  if (x < 0 || y < 0 || x > renderedWidth || y > renderedHeight) return null
  return {
    x: (x / renderedWidth) * video.videoWidth,
    y: (y / renderedHeight) * video.videoHeight
  }
}

calibratePortraitsButton.addEventListener('click', () => {
  calibrationDialog.showModal()
  selectCalibrationRow(Number(calibrationRowControl.value))
})

calibrationRowControl.addEventListener('change', () => {
  selectCalibrationRow(Number(calibrationRowControl.value))
})

calibrationSizeControl.addEventListener('input', () => {
  const row = Number(calibrationRowControl.value)
  if (row === championCropPositions.length) {
    minimapCrop.size = Number(calibrationSizeControl.value)
    saveMinimapCrop()
    drawCalibrationPreview()
    return
  }
  const crop = championCropPositions[row]
  if (!crop) return
  clearAutomaticChampionDetection(row)
  crop.size = Number(calibrationSizeControl.value)
  saveChampionCropPositions()
  drawCalibrationPreview()
})

resetCalibrationButton.addEventListener('click', () => {
  for (let index = 0; index < championCropPositions.length; index += 1) {
    clearAutomaticChampionDetection(index)
  }
  championCropPositions.splice(0, championCropPositions.length, ...defaultChampionCropPositions())
  minimapCrop = video
    ? defaultMinimapCrop(video.videoWidth, video.videoHeight)
    : defaultMinimapCrop()
  saveChampionCropPositions()
  saveMinimapCrop()
  selectCalibrationRow(Number(calibrationRowControl.value))
  calibrationFeedbackElement.textContent = 'Posições padrão restauradas.'
})

calibrationCanvas.addEventListener('pointerdown', (event) => {
  if (!video) return
  const point = calibrationPointFromEvent(event)
  if (!point) return
  if (
    Math.abs(point.x - minimapCrop.x * video.videoWidth) <= minimapCrop.size * video.videoWidth / 2 &&
    Math.abs(point.y - minimapCrop.y * video.videoHeight) <= minimapCrop.size * video.videoWidth / 2
  ) {
    selectCalibrationRow(championCropPositions.length)
  }
  const isMapCrop = Number(calibrationRowControl.value) === championCropPositions.length
  const hitRow = championCropPositions.findIndex((crop) => {
    const size = crop.size * video!.videoWidth
    return Math.hypot(
      point.x - crop.x * video!.videoWidth,
      point.y - crop.y * video!.videoHeight
    ) <= size / 2
  })
  const row = isMapCrop
    ? championCropPositions.length
    : hitRow >= 0
      ? hitRow
      : Number(calibrationRowControl.value)
  if (row === championCropPositions.length) {
    calibrationDragOffset = {
      x: point.x - minimapCrop.x * video.videoWidth,
      y: point.y - minimapCrop.y * video.videoHeight
    }
    calibrationDragRow = row
    calibrationCanvas.setPointerCapture(event.pointerId)
    event.preventDefault()
    return
  }
  clearAutomaticChampionDetection(row)
  selectCalibrationRow(row)
  const crop = championCropPositions[row]
  calibrationDragOffset = {
    x: point.x - crop.x * video.videoWidth,
    y: point.y - crop.y * video.videoHeight
  }
  calibrationDragRow = row
  calibrationCanvas.setPointerCapture(event.pointerId)
  event.preventDefault()
})

calibrationCanvas.addEventListener('pointermove', (event) => {
  if (calibrationDragRow === null || !video) return
  const point = calibrationPointFromEvent(event)
  if (calibrationDragRow === championCropPositions.length) {
    if (!point) return
    const size = minimapCrop.size * video.videoWidth
    minimapCrop.x = Math.min(
      1 - size / (2 * video.videoWidth),
      Math.max(size / (2 * video.videoWidth), (point.x - calibrationDragOffset.x) / video.videoWidth)
    )
    minimapCrop.y = Math.min(
      1 - size / (2 * video.videoHeight),
      Math.max(size / (2 * video.videoHeight), (point.y - calibrationDragOffset.y) / video.videoHeight)
    )
    saveMinimapCrop()
    drawCalibrationPreview()
    event.preventDefault()
    return
  }
  const crop = championCropPositions[calibrationDragRow]
  if (!point || !crop) return
  const size = crop.size * video.videoWidth
  crop.x = Math.min(
    1 - size / (2 * video.videoWidth),
    Math.max(size / (2 * video.videoWidth), (point.x - calibrationDragOffset.x) / video.videoWidth)
  )
  crop.y = Math.min(
    1 - size / (2 * video.videoHeight),
    Math.max(size / (2 * video.videoHeight), (point.y - calibrationDragOffset.y) / video.videoHeight)
  )
  saveChampionCropPositions()
  drawCalibrationPreview()
  event.preventDefault()
})

function finishCalibrationDrag(): void {
  calibrationDragRow = null
}

calibrationCanvas.addEventListener('pointerup', finishCalibrationDrag)
calibrationCanvas.addEventListener('pointercancel', finishCalibrationDrag)

function analyzeFrame(): void {
  drawPreview()
  if (calibrationDialog.open) drawCalibrationPreview()
  updateScoreboardDetection()
  if (!laneDetectionEnabled || !region || screen.width === 0 || screen.height === 0) return

  const left = Math.max(0, Math.floor(region.left))
  const top = Math.max(0, Math.floor(region.top))
  const right = Math.min(screen.width, Math.ceil(region.right))
  const bottom = Math.min(screen.height, Math.ceil(region.bottom))
  enemyMarkers = detectEnemyMarkers(
    matcherContext.getImageData(left, top, right - left, bottom - top)
  )
  const laneCounts = countMarkersByLane(enemyMarkers)
  refreshMissingLaneMinimapVisibility(laneCounts, Date.now())
  updateLaneCountAlerts(laneCounts)
  void inspectJungler()
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
  resetLaneTracking()
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
    championCropPositions = loadChampionCropPositions(video.videoWidth, video.videoHeight)
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
      setStatus('Lendo o cronômetro do jogo para iniciar a detecção das lanes em 01:20.')
      clockTimer = window.setInterval(() => {
        void readGameClock()
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
