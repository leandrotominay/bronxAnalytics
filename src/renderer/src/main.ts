/// <reference types="vite/client" />

import championCatalog from '../assets/champions.json'
import type { LiveClientRosterResult } from '../../shared/live-client-data'

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
      readLiveClientRoster: () => Promise<LiveClientRosterResult>
      initializeGameOcr: () => Promise<boolean>
      readGameClock: (image: Uint8Array) => Promise<{ text: string; confidence: number }>
      saveDiagnosticSample: (sample: {
        manifest: string
        images: Record<string, string>
      }) => Promise<string | null>
      stopGameOcr: () => Promise<void>
    }

  }
}

const eventList = document.querySelector<HTMLOListElement>('#event-list')
const eventCount = document.querySelector<HTMLElement>('#event-count')
const startButton = document.querySelector<HTMLButtonElement>('#start-button')
const stopButton = document.querySelector<HTMLButtonElement>('#stop-button')
const screenCanvas = document.querySelector<HTMLCanvasElement>('#screen-canvas')
const status = document.querySelector<HTMLParagraphElement>('#status')
const junglerCard = document.querySelector<HTMLElement>('#jungler-card')
const junglerPortraitImage = document.querySelector<HTMLImageElement>('#jungler-portrait')
const junglerLocationText = document.querySelector<HTMLElement>('#jungler-location')
const enemyRoster = document.querySelector<HTMLElement>('#enemy-roster')
const rosterStatus = document.querySelector<HTMLElement>('#roster-status')
const enemyPlayerList = document.querySelector<HTMLOListElement>('#enemy-player-list')
const calibrateMinimapButton = document.querySelector<HTMLButtonElement>(
  '#calibrate-minimap-button'
)
const minimapCalibrationDialog = document.querySelector<HTMLDialogElement>(
  '#minimap-calibration'
)
const calibrationPreview = document.querySelector<HTMLCanvasElement>('#calibration-preview')
const calibrationSizeInput = document.querySelector<HTMLInputElement>('#calibration-size')
const resetCalibrationButton = document.querySelector<HTMLButtonElement>(
  '#reset-calibration-button'
)
const calibrationFeedback = document.querySelector<HTMLElement>('#calibration-feedback')
const calibrationResolution = document.querySelector<HTMLElement>('#calibration-resolution')
const diagnosticModeButton = document.querySelector<HTMLButtonElement>('#diagnostic-mode-button')
const developerModeButton = document.querySelector<HTMLButtonElement>('#developer-mode-button')
const developerTools = document.querySelector<HTMLElement>('#developer-tools')
const voiceSettingsButton = document.querySelector<HTMLButtonElement>('#voice-settings-button')
const voiceSettingsPanel = document.querySelector<HTMLElement>('#voice-settings')
const alertVoiceSelect = document.querySelector<HTMLSelectElement>('#alert-voice-select')
const alertVoiceRate = document.querySelector<HTMLInputElement>('#alert-voice-rate')
const alertVoicePitch = document.querySelector<HTMLInputElement>('#alert-voice-pitch')
const alertVoiceRateValue = document.querySelector<HTMLOutputElement>('#alert-voice-rate-value')
const alertVoicePitchValue = document.querySelector<HTMLOutputElement>('#alert-voice-pitch-value')
const testVoiceButton = document.querySelector<HTMLButtonElement>('#test-voice-button')
const voiceSettingsStatus = document.querySelector<HTMLElement>('#voice-settings-status')
const captureDiagnosticButton = document.querySelector<HTMLButtonElement>(
  '#capture-diagnostic-button'
)
const expectedChampionInput = document.querySelector<HTMLInputElement>('#expected-jungler')
const expectedZoneSelect = document.querySelector<HTMLSelectElement>('#expected-zone')
const diagnosticStatus = document.querySelector<HTMLElement>('#diagnostic-status')
const liveDiagnostics = document.querySelector<HTMLElement>('#live-diagnostics')
const diagnosticMinimapCanvas = document.querySelector<HTMLCanvasElement>(
  '#diagnostic-minimap-preview'
)

if (
  !eventList ||
  !eventCount ||
  !startButton ||
  !stopButton ||
  !screenCanvas ||
  !status ||
  !junglerCard ||
  !junglerPortraitImage ||
  !junglerLocationText ||
  !enemyRoster ||
  !rosterStatus ||
  !enemyPlayerList ||
  !calibrateMinimapButton ||
  !minimapCalibrationDialog ||
  !calibrationPreview ||
  !calibrationSizeInput ||
  !resetCalibrationButton ||
  !calibrationFeedback ||
  !calibrationResolution ||
  !diagnosticModeButton ||
  !developerModeButton ||
  !developerTools ||
  !voiceSettingsButton ||
  !voiceSettingsPanel ||
  !alertVoiceSelect ||
  !alertVoiceRate ||
  !alertVoicePitch ||
  !alertVoiceRateValue ||
  !alertVoicePitchValue ||
  !testVoiceButton ||
  !voiceSettingsStatus ||
  !captureDiagnosticButton ||
  !expectedChampionInput ||
  !expectedZoneSelect ||
  !diagnosticStatus ||
  !liveDiagnostics ||
  !diagnosticMinimapCanvas
) {
  throw new Error('Required companion UI elements were not found.')
}

const events = eventList
const eventCountElement = eventCount
const screen = screenCanvas
const captureStatus = status
const startCaptureButton = startButton
const stopCaptureButton = stopButton
const jungleCard = junglerCard
const junglePortrait = junglerPortraitImage
const jungleLocation = junglerLocationText
const roster = enemyRoster
const rosterStatusElement = rosterStatus
const playerList = enemyPlayerList
const calibrationCanvas = calibrationPreview
const calibrationDialog = minimapCalibrationDialog
const calibrateMinimapControl = calibrateMinimapButton
const calibrationSizeControl = calibrationSizeInput
const calibrationFeedbackElement = calibrationFeedback
const calibrationResolutionElement = calibrationResolution
const diagnosticModeControl = diagnosticModeButton
const developerModeControl = developerModeButton
const developerToolsPanel = developerTools
const voiceSettingsToggle = voiceSettingsButton
const voiceSettings = voiceSettingsPanel
const alertVoiceControl = alertVoiceSelect
const alertVoiceRateControl = alertVoiceRate
const alertVoicePitchControl = alertVoicePitch
const alertVoiceRateOutput = alertVoiceRateValue
const alertVoicePitchOutput = alertVoicePitchValue
const testVoiceControl = testVoiceButton
const voiceSettingsStatusElement = voiceSettingsStatus
const captureDiagnosticControl = captureDiagnosticButton
const expectedChampionControl = expectedChampionInput
const expectedZoneControl = expectedZoneSelect
const diagnosticStatusElement = diagnosticStatus
const liveDiagnosticsElement = liveDiagnostics
const diagnosticMinimapPreview = diagnosticMinimapCanvas
const diagnosticMinimapContext = diagnosticMinimapPreview.getContext('2d')
if (!diagnosticMinimapContext) throw new Error('Could not initialize minimap diagnostics preview.')
const diagnosticMapContext = diagnosticMinimapContext
const calibrationContext = calibrationCanvas.getContext('2d')
if (!calibrationContext) throw new Error('Could not initialize minimap calibration preview.')
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
const portraitCanvas = document.createElement('canvas')
portraitCanvas.width = 48
portraitCanvas.height = 48
const portraitContext = portraitCanvas.getContext('2d', { willReadFrequently: true })
const minimapCanvas = document.createElement('canvas')
minimapCanvas.width = 192
minimapCanvas.height = 192
const minimapContext = minimapCanvas.getContext('2d', { willReadFrequently: true })
if (!portraitContext || !minimapContext) {
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
type LaneSource = 'api' | 'manual' | 'unknown'
type MapSide = 'blue' | 'red'
type AlertVoicePreferences = { voiceURI: string; rate: number; pitch: number }
type JungleCamp = 'blue-buff' | 'red-buff' | 'wolves' | 'raptors' | 'gromp' | 'krugs'
type JungleZone =
  | 'baron-pit'
  | 'dragon-pit'
  | 'river-top'
  | 'river-mid'
  | 'river-bot'
  | 'mid-lane'
  | 'top-lane'
  | 'bot-lane'
  | 'blue-base'
  | 'red-base'
  | `camp:${MapSide}:${JungleCamp}`
  | `jungle:${MapSide}`
type ChampionDefinition = { id: string; name: string }
type ChampionTemplate = ChampionDefinition & { url: string }
type MinimapCrop = { x: number; y: number; size: number }
type MinimapScanDiagnostics = {
  status: 'not-run' | 'no-red-ring' | 'no-valid-match' | 'score-too-high' | 'ambiguous' | 'found'
  point: Point | null
  zone: JungleZone | null
  bestScore: number | null
  runnerUpScore: number | null
  redRingSamples: number
}
type EnemyPlayer = {
  id: string
  lane: TeamLane
  laneSource: LaneSource
  championId: string | null
  championName: string | null
  portrait: ImageData | null
  portraitUrl: string | null
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
const liveClientPollInterval = 2500
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
const teamLaneOrder: TeamLane[] = ['top', 'jungle', 'mid', 'adc', 'support']
const minimapCropStorageKey = 'league-event-companion.minimap-crops.v1'
const alertVoiceStorageKey = 'bronx-analytics.alert-voice.v1'
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
let rosterRefreshTimer: number | null = null
let rosterRefreshInProgress = false
let laneDetectionEnabled = false
let rosterPromptAnnounced = false
let voidGrubAlertAnnounced = false
let lastRecognizedClock: number | null = null
let stableClockCandidate: number | null = null
let stableClockSamples = 0
let lastClockSampleAt = 0
let lastClockReadings: Array<{
  region: string
  text: string
  confidence: number
  parsedSeconds: number | null
}> = []
let junglePortraitTemplate: ImageData | null = null
let ownTeamSide: MapSide | null = null
let lastJungleScanAt = 0
let jungleScanInProgress = false
let pendingJungleZone: JungleZone | null = null
let pendingJungleZoneScans = 0
let pendingJunglePoint: Point | null = null
let announcedJungleZone: JungleZone | null = null
let lastConfirmedJungleZone: JungleZone | null = null
let jungleMissedScans = 0
let enemyPlayers: EnemyPlayer[] = []
let draggedEnemyPlayerId: string | null = null
let jungleCaptureAnnounced = false
let activeJunglerPlayerId: string | null = null
let enemyDetectionAnnounced = false
let lastMissingLaneMinimapScanAt = 0
let isDraggingMinimapCrop = false
let calibrationDragOffset: Point = { x: 0, y: 0 }
let championTemplates: ChampionTemplate[] | null = null
let championTemplatesPromise: Promise<ChampionTemplate[]> | null = null
let activeCaptureProfile = ''
let minimapCrop = defaultMinimapCrop()
let diagnosticMode = false
let alertVoiceStorageWarning: string | null = null
let alertVoicePreferences: AlertVoicePreferences = {
  voiceURI: '',
  rate: 1,
  pitch: 1
}
let lastJungleScanDiagnostics: MinimapScanDiagnostics = {
  status: 'not-run',
  point: null,
  zone: null,
  bestScore: null,
  runnerUpScore: null,
  redRingSamples: 0
}

function loadAlertVoicePreferences(): void {
  try {
    const saved = window.localStorage.getItem(alertVoiceStorageKey)
    if (!saved) return
    const parsed: unknown = JSON.parse(saved)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('voiceURI' in parsed) ||
      typeof parsed.voiceURI !== 'string' ||
      !('rate' in parsed) ||
      typeof parsed.rate !== 'number' ||
      !Number.isFinite(parsed.rate) ||
      !('pitch' in parsed) ||
      typeof parsed.pitch !== 'number' ||
      !Number.isFinite(parsed.pitch)
    ) {
      throw new Error('As preferências salvas de voz têm um formato inválido.')
    }
    alertVoicePreferences = {
      voiceURI: parsed.voiceURI,
      rate: Math.min(1.25, Math.max(0.75, parsed.rate)),
      pitch: Math.min(1.3, Math.max(0.7, parsed.pitch))
    }
  } catch (error) {
    console.error('Could not load alert voice preferences.', error)
    alertVoiceStorageWarning =
      'Não foi possível carregar as preferências salvas; usando os valores padrão.'
  }
  alertVoiceControl.value = alertVoicePreferences.voiceURI
  alertVoiceRateControl.value = String(alertVoicePreferences.rate)
  alertVoicePitchControl.value = String(alertVoicePreferences.pitch)
  updateAlertVoiceOutputs()
}

function persistAlertVoicePreferences(): void {
  try {
    window.localStorage.setItem(alertVoiceStorageKey, JSON.stringify(alertVoicePreferences))
  } catch (error) {
    console.error('Could not save alert voice preferences.', error)
    alertVoiceStorageWarning = 'As alterações foram aplicadas, mas não puderam ser salvas.'
    voiceSettingsStatusElement.textContent = alertVoiceStorageWarning
    return
  }
  alertVoiceStorageWarning = null
}

function updateAlertVoiceOutputs(): void {
  alertVoiceRateOutput.value = `${alertVoicePreferences.rate.toFixed(2)}×`
  alertVoicePitchOutput.value = alertVoicePreferences.pitch.toFixed(2)
}

function speakLocally(text: string): void {
  if (!('speechSynthesis' in window)) {
    throw new Error('A síntese de voz local não está disponível.')
  }
  if (alertVoicePreferences.voiceURI && !selectedAlertVoice()) {
    throw new Error('A voz local selecionada não está mais disponível.')
  }
  window.speechSynthesis.speak(createAlertUtterance(text))
}

function selectedAlertVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window) || !alertVoicePreferences.voiceURI) return null
  return window.speechSynthesis
    .getVoices()
    .find((voice) => voice.voiceURI === alertVoicePreferences.voiceURI) ?? null
}

function refreshAlertVoices(): void {
  if (!('speechSynthesis' in window)) {
    voiceSettingsStatusElement.textContent =
      'A síntese de voz não está disponível nesta instalação.'
    testVoiceControl.disabled = true
    alertVoiceControl.disabled = true
    return
  }
  const voices = window.speechSynthesis.getVoices()
  const selectedUri = alertVoicePreferences.voiceURI
  const fragment = document.createDocumentFragment()
  const automaticOption = document.createElement('option')
  automaticOption.value = ''
  automaticOption.textContent = 'Automática (Português do sistema)'
  fragment.append(automaticOption)
  for (const voice of voices) {
    const option = document.createElement('option')
    option.value = voice.voiceURI
    option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' · padrão' : ''}`
    fragment.append(option)
  }
  alertVoiceControl.replaceChildren(fragment)
  if (selectedUri && voices.some((voice) => voice.voiceURI === selectedUri)) {
    alertVoiceControl.value = selectedUri
  } else if (voices.length > 0) {
    alertVoicePreferences.voiceURI = ''
    alertVoiceControl.value = ''
  }
  if (voices.length === 0) {
    voiceSettingsStatusElement.textContent =
      'Nenhuma voz foi listada ainda. Instale ou habilite uma voz nas configurações de fala do sistema.'
  } else {
    voiceSettingsStatusElement.textContent =
      `${voices.length} voz(es) disponível(is) neste computador. A lista pode incluir vozes de idiomas diferentes.`
  }
  if (alertVoiceStorageWarning) {
    voiceSettingsStatusElement.textContent += ` ${alertVoiceStorageWarning}`
  }
}

function createAlertUtterance(text: string): SpeechSynthesisUtterance {
  const utterance = new SpeechSynthesisUtterance(text)
  const voice = selectedAlertVoice()
  utterance.voice = voice
  utterance.lang = voice?.lang ?? 'pt-BR'
  utterance.rate = alertVoicePreferences.rate
  utterance.pitch = alertVoicePreferences.pitch
  return utterance
}

function configureAlertVoice(): void {
  loadAlertVoicePreferences()
  refreshAlertVoices()
  if ('speechSynthesis' in window) {
    window.speechSynthesis.addEventListener('voiceschanged', refreshAlertVoices)
  }
}

configureAlertVoice()

voiceSettingsToggle.addEventListener('click', () => {
  const expanded = voiceSettingsToggle.getAttribute('aria-expanded') === 'true'
  voiceSettingsToggle.setAttribute('aria-expanded', String(!expanded))
  voiceSettings.hidden = expanded
  if (!expanded) refreshAlertVoices()
})

alertVoiceControl.addEventListener('change', () => {
  alertVoicePreferences.voiceURI = alertVoiceControl.value
  persistAlertVoicePreferences()
  const voice = selectedAlertVoice()
  voiceSettingsStatusElement.textContent = voice
    ? `Voz selecionada: ${voice.name} (${voice.lang}).`
    : 'Usando a voz padrão de Português do sistema.'
})

alertVoiceRateControl.addEventListener('input', () => {
  alertVoicePreferences.rate = Number(alertVoiceRateControl.value)
  updateAlertVoiceOutputs()
  persistAlertVoicePreferences()
})

alertVoicePitchControl.addEventListener('input', () => {
  alertVoicePreferences.pitch = Number(alertVoicePitchControl.value)
  updateAlertVoiceOutputs()
  persistAlertVoicePreferences()
})

testVoiceControl.addEventListener('click', () => {
  if (!('speechSynthesis' in window)) {
    voiceSettingsStatusElement.textContent = 'A síntese de voz não está disponível.'
    return
  }
  if (alertVoicePreferences.voiceURI && !selectedAlertVoice()) {
    voiceSettingsStatusElement.textContent =
      'A voz selecionada não está mais disponível. Escolha outra voz na lista.'
    return
  }
  window.speechSynthesis.cancel()
  const utterance = createAlertUtterance(
    'Prévia de voz. O jungler inimigo foi localizado.'
  )
  utterance.onend = () => {
    voiceSettingsStatusElement.textContent = 'Prévia concluída.'
  }
  utterance.onerror = (event) => {
    console.error('Alert voice preview failed.', event.error)
    voiceSettingsStatusElement.textContent =
      `Não foi possível reproduzir a prévia: ${event.error}.`
  }
  voiceSettingsStatusElement.textContent = 'Reproduzindo prévia...'
  window.speechSynthesis.speak(utterance)
})

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
  eventCountElement.textContent = String(events.querySelectorAll('.event-card').length)
  window.companion.publishOverlayAlert(titleText)
  if (diagnosticMode) {
    item.dataset.diagnosticSuppressed = 'true'
    return item
  }

  if ('speechSynthesis' in window) {
    try {
      speakLocally(titleText)
    } catch (error) {
      console.error('Local alert speech failed.', error)
      voiceSettingsStatusElement.textContent =
        `Não foi possível reproduzir o alerta: ${error instanceof Error ? error.message : 'erro inesperado'}.`
    }
  }
  return item
}

function setStatus(message: string): void {
  captureStatus.textContent = message
}

function setDiagnosticMode(enabled: boolean): void {
  diagnosticMode = enabled
  diagnosticModeControl.setAttribute('aria-pressed', String(enabled))
  diagnosticModeControl.textContent = enabled
    ? 'Reativar áudio dos alertas'
    : 'Pausar áudio dos alertas'
  captureDiagnosticControl.disabled = !video
  diagnosticStatusElement.textContent = enabled
    ? 'Diagnóstico ligado: alertas visuais ativos; áudio pausado. Desligue para reativar a voz.'
    : 'Modo normal: alertas visuais e sonoros ativos. Você pode salvar amostras sem pausar os avisos.'
  if (stream) {
    void window.companion.setOverlayActive(true).catch((error: unknown) => {
      console.error('Could not update the alert overlay for diagnostic mode.', error)
      diagnosticStatusElement.textContent =
        'Não foi possível ativar o overlay de alertas.'
    })
  }
}

function setDeveloperMode(enabled: boolean): void {
  developerToolsPanel.hidden = !enabled
  developerModeControl.setAttribute('aria-pressed', String(enabled))
  document.body.classList.toggle('developer-mode', enabled)
}

setDiagnosticMode(false)
setDeveloperMode(false)

diagnosticModeControl.addEventListener('click', () => {
  setDiagnosticMode(!diagnosticMode)
})

developerModeControl.addEventListener('click', () => {
  setDeveloperMode(developerToolsPanel.hidden)
})

function resetMatchEvents(): void {
  laneDetectionEnabled = false
  rosterPromptAnnounced = false
  voidGrubAlertAnnounced = false
  lastRecognizedClock = null
  stableClockCandidate = null
  stableClockSamples = 0
  lastClockSampleAt = 0
  lastClockReadings = []
  junglePortraitTemplate = null
  enemyDetectionAnnounced = false
  lastMissingLaneMinimapScanAt = 0
  lastJungleScanAt = 0
  pendingJungleZone = null
  pendingJungleZoneScans = 0
  pendingJunglePoint = null
  announcedJungleZone = null
  lastConfirmedJungleZone = null
  jungleMissedScans = 0
  ownTeamSide = null
  enemyPlayers = []
  jungleCaptureAnnounced = false
  activeJunglerPlayerId = null
  roster.hidden = true
  rosterStatusElement.textContent = 'Aguardando captura para consultar a API local da partida.'
  playerList.replaceChildren()
  jungleCard.hidden = true
  junglePortrait.removeAttribute('src')
  jungleLocation.textContent = 'Aguardando a API local da partida.'
}

function parseGameClock(text: string): number | null {
  const match = text.match(/(?:^|[^\d])(\d{1,2})\s*:\s*([0-5]\d)(?!\d)/)
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

function laneFromLivePosition(position: string): TeamLane | null {
  switch (position.trim().toLocaleUpperCase()) {
    case 'TOP':
      return 'top'
    case 'JUNGLE':
      return 'jungle'
    case 'MID':
    case 'MIDDLE':
      return 'mid'
    case 'BOT':
    case 'BOTTOM':
      return 'adc'
    case 'UTILITY':
    case 'SUPPORT':
      return 'support'
    default:
      return null
  }
}

function championFromLiveName(name: string): ChampionDefinition | null {
  const normalize = (value: string): string =>
    value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
  const normalizedName = normalize(name)
  return (championCatalog.champions as ChampionDefinition[]).find(
    (champion) =>
      normalize(champion.id) === normalizedName ||
      normalize(champion.name) === normalizedName
  ) ?? null
}

async function applyLiveClientRoster(result: LiveClientRosterResult): Promise<void> {
  roster.hidden = false
  if (result.status === 'unavailable') {
    rosterStatusElement.textContent = `API local indisponível: ${result.message}`
    return
  }
  ownTeamSide = result.ownTeamSide
  if (result.players.length !== teamLaneOrder.length) {
    enemyPlayers = []
    playerList.replaceChildren()
    updateJunglePortrait()
    rosterStatusElement.textContent =
      `API local conectada, mas retornou ${result.players.length} oponentes; ` +
      `este companion espera ${teamLaneOrder.length}.`
    return
  }

  const previousPlayers = new Map(enemyPlayers.map((player) => [player.id, player]))
  const apiLanes = result.players.map((player) => laneFromLivePosition(player.position))
  const apiLaneCounts = new Map<TeamLane, number>()
  for (const lane of apiLanes) {
    if (lane) apiLaneCounts.set(lane, (apiLaneCounts.get(lane) ?? 0) + 1)
  }
  enemyPlayers = result.players.map((apiPlayer, index) => {
    const id = `enemy-player-${index}`
    const previous = previousPlayers.get(id)
    const apiLane = apiLanes[index] ?? null
    const uniqueApiLane =
      apiLane && apiLaneCounts.get(apiLane) === 1 ? apiLane : null
    const laneSource =
      previous?.laneSource === 'manual'
        ? 'manual'
        : uniqueApiLane
          ? 'api'
          : 'unknown'
    return {
      id,
      lane: previous?.laneSource === 'manual'
        ? previous.lane
        : uniqueApiLane ?? previous?.lane ?? teamLaneOrder[index],
      laneSource,
      championId: previous?.championId ?? null,
      championName: previous?.championName ?? null,
      portrait: previous?.portrait ?? null,
      portraitUrl: previous?.portraitUrl ?? null
    }
  })

  for (let index = 0; index < result.players.length; index += 1) {
    const apiPlayer = result.players[index]
    const player = enemyPlayers[index]
    if (!apiPlayer || !player) continue
    const champion = championFromLiveName(apiPlayer.championName)
    if (!champion) {
      player.championId = null
      player.championName = apiPlayer.championName
      player.portrait = null
      player.portraitUrl = null
      continue
    }
    if (player.championId !== champion.id || !player.portrait) {
      await assignPlayerChampion(player, champion.id, false)
    }
  }

  const unknownPositions = enemyPlayers.filter((player) => player.laneSource === 'unknown').length
  const positionMessage = unknownPositions > 0
    ? `; posições não informadas para ${unknownPositions}, corrija no seletor`
    : ''
  rosterStatusElement.textContent =
    `API local conectada; ${enemyPlayers.length} oponentes identificados${positionMessage}.`
  if (!enemyDetectionAnnounced) {
    enemyDetectionAnnounced = true
    announceEvent('Inimigos detectados com sucesso.')
  }
  renderEnemyRoster()
  updateJunglePortrait()
}

async function refreshLiveClientRoster(): Promise<void> {
  if (!stream || rosterRefreshInProgress) return
  const requestedStream = stream
  rosterRefreshInProgress = true
  try {
    const result = await window.companion.readLiveClientRoster()
    if (stream === requestedStream) await applyLiveClientRoster(result)
  } catch (error) {
    console.error('Could not retrieve the local League match roster.', error)
    roster.hidden = false
    rosterStatusElement.textContent =
      error instanceof Error
        ? `Falha ao consultar a API local: ${error.message}`
        : 'Falha ao consultar a API local da partida.'
  } finally {
    rosterRefreshInProgress = false
  }
}

async function loadChampionLibrary(): Promise<ChampionTemplate[]> {
  if (championTemplates) return championTemplates
  if (championTemplatesPromise) return championTemplatesPromise

  const definitions = championCatalog.champions as ChampionDefinition[]
  championTemplatesPromise = Promise.resolve(definitions.map((champion) => {
    const url = championImageUrls[`../assets/champions/${champion.id}.png`]
    if (!url) throw new Error(`Missing local Data Dragon portrait for ${champion.id}.`)
    return { ...champion, url }
  }))
  try {
    championTemplates = await championTemplatesPromise
    return championTemplates
  } catch (error) {
    championTemplatesPromise = null
    throw error
  }
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

    const readable = document.createElement('div')
    readable.className = 'enemy-player-readable'
    const readableName = document.createElement('strong')
    readableName.textContent = player.championName ?? 'Oponente'
    const readableLane = document.createElement('span')
    readableLane.textContent =
      player.laneSource === 'unknown' ? 'POSIÇÃO?' : teamLaneLabels[player.lane]
    readable.append(readableName, readableLane)

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
    if (player.championName && !player.championId) {
      unknownChampion.textContent = `${player.championName} (ícone local indisponível)`
    }
    champion.addEventListener('change', () => {
      void assignPlayerChampion(player, champion.value)
    })

    const lane = document.createElement('select')
    lane.className = 'enemy-player-lane'
    lane.setAttribute('aria-label', `Posição de ${player.championName ?? 'campeão não identificado'}`)
    const unknownPosition = document.createElement('option')
    unknownPosition.value = ''
    unknownPosition.textContent = 'Posição não informada pela API'
    unknownPosition.selected = player.laneSource === 'unknown'
    lane.append(unknownPosition)
    for (const optionLane of teamLaneOrder) {
      const option = document.createElement('option')
      option.value = optionLane
      option.textContent = teamLaneLabels[optionLane]
      option.selected =
        player.laneSource !== 'unknown' && optionLane === player.lane
      lane.append(option)
    }
    lane.addEventListener('change', () => {
      const selectedLane = teamLaneOrder.find((optionLane) => optionLane === lane.value)
      if (selectedLane) assignPlayerLane(player, selectedLane)
    })

    details.append(readable, champion, lane)
    item.append(portrait, placeholder, details)
    fragment.append(item)
  }
  playerList.replaceChildren(fragment)
}

async function assignPlayerChampion(
  player: EnemyPlayer,
  championId: string,
  manuallySelected = true
): Promise<void> {
  if (!championId) {
    player.championId = null
    player.championName = null
    player.portrait = null
    player.portraitUrl = null
    updateJunglePortrait()
    renderEnemyRoster()
    return
  }

  try {
    if (
      manuallySelected &&
      enemyPlayers.some((entry) => entry.id !== player.id && entry.championId === championId)
    ) {
      throw new Error('Esse campeão já está atribuído a outra linha.')
    }
    const templates = await loadChampionLibrary()
    const selected = templates.find((champion) => champion.id === championId)
    if (!selected) throw new Error(`Champion ${championId} is not in the local catalog.`)
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
    player.championId = selected.id
    player.championName = selected.name
    player.portraitUrl = selected.url
    player.portrait = portraitContext!.getImageData(0, 0, portraitCanvas.width, portraitCanvas.height)
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
  if (player.lane === lane && player.laneSource === 'manual') return
  const displacedPlayer = enemyPlayers.find((entry) => entry.lane === lane)
  if (displacedPlayer) {
    displacedPlayer.lane = player.lane
    displacedPlayer.laneSource = 'manual'
  }
  player.lane = lane
  player.laneSource = 'manual'
  updateJunglePortrait()
  renderEnemyRoster()
}

function updateJunglePortrait(): void {
  const jungler = enemyPlayers.find(
    (player) => player.lane === 'jungle' && player.laneSource !== 'unknown'
  )
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
  jungleLocation.textContent = 'Ícone do jungler carregado; procurando no minimapa.'
  pendingJungleZone = null
  pendingJungleZoneScans = 0
  pendingJunglePoint = null
  announcedJungleZone = null
  lastConfirmedJungleZone = null
  jungleMissedScans = 0
  if (!jungleCaptureAnnounced) {
    jungleCaptureAnnounced = true
    announceEvent('Jungler identificado pela API; buscando no minimapa.')
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
  if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return null

  if (Math.hypot(point.x - 0.3, point.y - 0.16) <= 0.045) return 'baron-pit'
  if (Math.hypot(point.x - 0.8, point.y - 0.8) <= 0.075) return 'dragon-pit'

  const campAnchors: Array<{
    name: JungleCamp
    side: MapSide
    x: number
    y: number
  }> = [
    { name: 'blue-buff', side: 'blue', x: 0.2, y: 0.58 },
    { name: 'gromp', side: 'blue', x: 0.18, y: 0.38 },
    { name: 'wolves', side: 'blue', x: 0.34, y: 0.45 },
    { name: 'raptors', side: 'blue', x: 0.48, y: 0.58 },
    { name: 'red-buff', side: 'blue', x: 0.58, y: 0.7 },
    { name: 'krugs', side: 'blue', x: 0.69, y: 0.78 }
  ]
  let nearestCamp: (typeof campAnchors)[number] | null = null
  let nearestCampDistance = Number.POSITIVE_INFINITY
  for (const camp of campAnchors) {
    for (const side of ['blue', 'red'] as const) {
      const mirrored = side === 'red'
      const x = mirrored ? 1 - camp.x : camp.x
      const y = mirrored ? 1 - camp.y : camp.y
      const distance = Math.hypot(point.x - x, point.y - y)
      if (distance < nearestCampDistance) {
        nearestCamp = { ...camp, side, x, y }
        nearestCampDistance = distance
      }
    }
  }
  if (nearestCamp && nearestCampDistance <= 0.065) {
    return `camp:${nearestCamp.side}:${nearestCamp.name}`
  }

  const riverDistance = Math.abs(point.x - point.y) / Math.SQRT2
  if (riverDistance <= 0.075) {
    if (point.x < 0.38) return 'river-top'
    if (point.x > 0.62) return 'river-bot'
    return 'river-mid'
  }

  if (Math.hypot(point.x - 0.06, point.y - 0.94) <= 0.1) return 'blue-base'
  if (Math.hypot(point.x - 0.94, point.y - 0.06) <= 0.1) return 'red-base'

  const distanceToMid = Math.abs(point.x + point.y - 1) / Math.SQRT2
  if (distanceToMid <= 0.055) return 'mid-lane'
  if (point.x < 0.09 || point.y < 0.09) return 'top-lane'
  if (point.x > 0.91 || point.y > 0.91) return 'bot-lane'

  return point.x + point.y > 1 ? 'jungle:blue' : 'jungle:red'
}

function formatJungleZone(zone: JungleZone, ownSide: MapSide | null): string {
  if (zone === 'baron-pit') return 'Jungler no covil do Barão.'
  if (zone === 'dragon-pit') return 'Jungler no covil do Dragão.'
  if (zone === 'river-top') return 'Jungler no rio superior.'
  if (zone === 'river-mid') return 'Jungler no rio central.'
  if (zone === 'river-bot') return 'Jungler no rio inferior.'
  if (zone === 'mid-lane') return 'Jungler na rota do meio.'
  if (zone === 'top-lane') return 'Jungler na rota superior.'
  if (zone === 'bot-lane') return 'Jungler na rota inferior.'
  if (zone === 'blue-base' || zone === 'red-base') {
    const side = zone === 'blue-base' ? 'blue' : 'red'
    const sideName = side === 'blue' ? 'azul' : 'vermelha'
    const teamLabel = ownSide === null
      ? `do lado ${sideName}`
      : side === ownSide
        ? 'aliada'
        : 'inimiga'
    return `Jungler na base ${teamLabel} (${sideName}).`
  }

  const [area, side, location] = zone.split(':')
  const sideName = side === 'blue' ? 'azul' : 'vermelho'
  const teamLabel = ownSide === null
    ? `lado ${sideName}`
    : side === ownSide
      ? 'aliado'
      : 'inimigo'
  if (area === 'camp') {
    const campNames: Record<JungleCamp, string> = {
      'blue-buff': 'Blue',
      'red-buff': 'Red',
      wolves: 'Lobos',
      raptors: 'Acúleos',
      gromp: 'Grompe',
      krugs: 'Krugues'
    }
    const campName = Object.entries(campNames).find(([camp]) => camp === location)?.[1]
    return campName
      ? `Jungler no ${campName} ${teamLabel}.`
      : `Jungler na selva do lado ${teamLabel}.`
  }
  return area === 'jungle'
    ? `Jungler na selva do lado ${teamLabel}.`
    : 'Jungler em uma região não classificada.'
}

function findPortraitOnMinimap(template: ImageData): MinimapScanDiagnostics {
  const result: MinimapScanDiagnostics = {
    status: 'no-red-ring',
    point: null,
    zone: null,
    bestScore: null,
    runnerUpScore: null,
    redRingSamples: 0
  }
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
    result.status = 'not-run'
    return result
  }

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
  let maxObservedRingSamples = 0
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
        maxObservedRingSamples = Math.max(maxObservedRingSamples, redRingSamples)
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
  result.redRingSamples = maxObservedRingSamples
  if (!best) return result

  const secondDistinctCandidate = candidates.find((candidate) => {
    const distance = Math.hypot(candidate.x - best.x, candidate.y - best.y)
    return distance >= Math.max(best.size, candidate.size)
  })
  const point = {
    x: (best.x + best.size / 2) / width,
    y: (best.y + best.size / 2) / height
  }
  result.point = point
  result.bestScore = best.score
  result.runnerUpScore = secondDistinctCandidate?.score ?? null
  result.zone = classifyJungleZone(point)
  if (best.score > jungleMatchMaximumScore) {
    result.status = 'score-too-high'
  } else if (
    secondDistinctCandidate &&
    secondDistinctCandidate.score - best.score < jungleMatchMinimumMargin
  ) {
    result.status = 'ambiguous'
  } else {
    result.status = result.zone ? 'found' : 'no-valid-match'
  }
  return result
}

function findJunglerOnMinimap(): MinimapScanDiagnostics {
  if (!junglePortraitTemplate) {
    return {
      status: 'not-run',
      point: null,
      zone: null,
      bestScore: null,
      runnerUpScore: null,
      redRingSamples: 0
    }
  }
  return findPortraitOnMinimap(junglePortraitTemplate)
}

function updateDiagnosticPanel(): void {
  if (!diagnosticMode) return
  const dimensions =
    video && video.videoWidth > 0 && video.videoHeight > 0
      ? `${video.videoWidth}×${video.videoHeight}`
      : 'sem captura'
  const minimap = video ? estimateJunglerMapBounds(video.videoWidth, video.videoHeight) : null
  const laneCounts = countMarkersByLane(enemyMarkers)
  const laneWatchStatus = (['top', 'mid', 'bot'] as const)
    .map((lane) => {
      const watch = laneWatches[lane]
      const state = !watch.hasBeenSeen
        ? 'aguardando primeira detecção'
        : watch.missingSince === null
          ? 'visível'
          : `ausente ${formatElapsed(Math.floor((Date.now() - watch.missingSince) / 1000))}${watch.alerted ? ' (alertado)' : ''}`
      return `${lane.toUpperCase()}: ${state}, marcadores=${laneCounts[lane]}, alerta=${laneAlertState(lane, Date.now())}`
    })
    .join(' | ')
  const lines = [
    `Frame: ${dimensions}`,
    `Roster: ${rosterStatusElement.textContent ?? 'sem estado'}`,
    `Detecção das lanes: ${laneDetectionEnabled ? 'ativa' : 'aguardando 01:20'}; ${laneWatchStatus}`,
    `Relógio: ${lastRecognizedClock === null ? 'não lido' : formatElapsed(lastRecognizedClock)}`,
    `OCR bruto: ${lastClockReadings.length > 0
      ? lastClockReadings.map((reading) =>
          `${reading.region}: ${reading.text.trim().replace(/\s+/g, ' ') || 'sem leitura'} (${reading.confidence.toFixed(0)}%)`
        ).join(' | ')
      : 'sem leitura'}`,
    `Perfil de captura: ${activeCaptureProfile || 'aguardando captura'}`,
    `Minimapa: ${minimap ? `x=${minimap.left}, y=${minimap.top}, ${minimap.right - minimap.left}×${minimap.bottom - minimap.top}` : 'indisponível'}`,
    `Lado local: ${ownTeamSide ?? 'não identificado'}`,
    `Campeão do jungler: ${enemyPlayers.find((entry) => entry.lane === 'jungle')?.championName ?? 'não confirmado'}`,
    `Busca no mapa: ${lastJungleScanDiagnostics.status}`,
    `Anel vermelho (amostras): ${lastJungleScanDiagnostics.redRingSamples}`,
    `Score: ${lastJungleScanDiagnostics.bestScore?.toFixed(3) ?? '—'}; segundo candidato: ${lastJungleScanDiagnostics.runnerUpScore?.toFixed(3) ?? '—'}`,
    `Candidato: ${lastJungleScanDiagnostics.point && lastJungleScanDiagnostics.zone
      ? `${formatJungleZone(lastJungleScanDiagnostics.zone, ownTeamSide)} (${lastJungleScanDiagnostics.point.x.toFixed(3)}, ${lastJungleScanDiagnostics.point.y.toFixed(3)})`
      : 'nenhum confirmado'}`
  ]
  liveDiagnosticsElement.textContent = lines.join('\n')

  diagnosticMapContext.clearRect(
    0,
    0,
    diagnosticMinimapPreview.width,
    diagnosticMinimapPreview.height
  )
  if (!video || !minimap) return
  diagnosticMapContext.drawImage(
    video,
    minimap.left,
    minimap.top,
    minimap.right - minimap.left,
    minimap.bottom - minimap.top,
    0,
    0,
    diagnosticMinimapPreview.width,
    diagnosticMinimapPreview.height
  )
  const candidate = lastJungleScanDiagnostics.point
  if (candidate) {
    const x = candidate.x * diagnosticMinimapPreview.width
    const y = candidate.y * diagnosticMinimapPreview.height
    diagnosticMapContext.beginPath()
    diagnosticMapContext.arc(x, y, 9, 0, Math.PI * 2)
    diagnosticMapContext.strokeStyle =
      lastJungleScanDiagnostics.status === 'found' ? '#63e6be' : '#ff6b6b'
    diagnosticMapContext.lineWidth = 3
    diagnosticMapContext.stroke()
    diagnosticMapContext.beginPath()
    diagnosticMapContext.moveTo(x - 12, y)
    diagnosticMapContext.lineTo(x + 12, y)
    diagnosticMapContext.moveTo(x, y - 12)
    diagnosticMapContext.lineTo(x, y + 12)
    diagnosticMapContext.stroke()
  }
}

function canvasDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png')
}

async function saveDiagnosticSample(): Promise<void> {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
    diagnosticStatusElement.textContent = 'Inicie a captura antes de salvar uma amostra.'
    return
  }
  captureDiagnosticControl.disabled = true
  diagnosticStatusElement.textContent = 'Preparando amostra local...'
  try {
    const frameCanvas = document.createElement('canvas')
    frameCanvas.width = video.videoWidth
    frameCanvas.height = video.videoHeight
    const frameContext = frameCanvas.getContext('2d')
    if (!frameContext) throw new Error('Não foi possível capturar o frame atual.')
    frameContext.drawImage(video, 0, 0)

    const minimap = estimateJunglerMapBounds(video.videoWidth, video.videoHeight)
    const minimapCanvas = document.createElement('canvas')
    minimapCanvas.width = Math.ceil(minimap.right - minimap.left)
    minimapCanvas.height = Math.ceil(minimap.bottom - minimap.top)
    const minimapContext = minimapCanvas.getContext('2d')
    if (!minimapContext) throw new Error('Não foi possível capturar o recorte do minimapa.')
    minimapContext.drawImage(
      video,
      minimap.left,
      minimap.top,
      minimapCanvas.width,
      minimapCanvas.height,
      0,
      0,
      minimapCanvas.width,
      minimapCanvas.height
    )

    const images: Record<string, string> = {
      'frame-completo.png': canvasDataUrl(frameCanvas),
      'minimapa.png': canvasDataUrl(minimapCanvas)
    }

    const manifest = {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      frame: { width: video.videoWidth, height: video.videoHeight },
      captureProfile: activeCaptureProfile,
      gameClockSeconds: lastRecognizedClock,
      clockOcr: lastClockReadings,
      diagnosticMode,
      ownTeamSide,
      expected: {
        junglerChampion: expectedChampionControl.value.trim() || null,
        junglerZone: expectedZoneControl.value || null
      },
      minimapCrop,
      minimapRegion: minimap,
      roster: enemyPlayers.map((player) => ({
        lane: player.lane,
        laneSource: player.laneSource,
        championId: player.championId,
        championName: player.championName
      })),
      minimapScan: lastJungleScanDiagnostics,
      laneDetection: {
        enabled: laneDetectionEnabled,
        counts: countMarkersByLane(enemyMarkers),
        watches: Object.fromEntries(
          (['top', 'mid', 'bot'] as const).map((lane) => [
            lane,
            {
              hasBeenSeen: laneWatches[lane].hasBeenSeen,
              missingSeconds:
                laneWatches[lane].missingSince === null
                  ? null
                  : Math.floor((Date.now() - laneWatches[lane].missingSince) / 1000),
              alerted: laneWatches[lane].alerted,
              alertState: laneAlertState(lane, Date.now())
            }
          ])
        )
      },
      note: 'Captured locally from the user-authorized visible game window.'
    }
    const savedPath = await window.companion.saveDiagnosticSample({
      manifest: JSON.stringify(manifest, null, 2),
      images
    })
    diagnosticStatusElement.textContent = savedPath
      ? `Amostra salva localmente em: ${savedPath}`
      : 'Salvamento cancelado; nenhum arquivo foi criado.'
  } catch (error) {
    console.error('Could not save visual diagnostic sample.', error)
    diagnosticStatusElement.textContent =
      error instanceof Error
        ? `Falha ao salvar a amostra: ${error.message}`
        : 'Falha ao salvar a amostra diagnóstica.'
  } finally {
    captureDiagnosticControl.disabled = !video
  }
}

captureDiagnosticControl.addEventListener('click', () => {
  void saveDiagnosticSample()
})

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
    const player = findLanePlayer(lane)
    if (!player?.portrait) continue
    if (!findPortraitOnMinimap(player.portrait).point) continue

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
  if (jungleScanInProgress || Date.now() - lastJungleScanAt < jungleScanInterval) {
    return
  }
  jungleScanInProgress = true
  lastJungleScanAt = Date.now()
  try {
    if (!junglePortraitTemplate) {
      lastJungleScanDiagnostics = {
        status: 'not-run',
        point: null,
        zone: null,
        bestScore: null,
        runnerUpScore: null,
        redRingSamples: 0
      }
      updateDiagnosticPanel()
      return
    }

    const match = findJunglerOnMinimap()
    lastJungleScanDiagnostics = match
    updateDiagnosticPanel()
    if (match.status !== 'found' || !match.point || !match.zone) {
      jungleMissedScans += 1
      pendingJungleZone = null
      pendingJungleZoneScans = 0
      pendingJunglePoint = null
      if (jungleMissedScans >= 3) {
        announcedJungleZone = null
        jungleLocation.textContent = lastConfirmedJungleZone
          ? `Jungler não visível; última posição confirmada: ${formatJungleZone(lastConfirmedJungleZone, ownTeamSide)}`
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

    const message = formatJungleZone(match.zone, ownTeamSide)
    jungleLocation.textContent = `Jungler visível: ${message}`
    if (announcedJungleZone === match.zone) return

    announcedJungleZone = match.zone
    lastConfirmedJungleZone = match.zone
    announceEvent(message)
  } catch (error) {
    console.error('Could not inspect the enemy jungler on the minimap.', error)
    setStatus(
      error instanceof Error
        ? `Análise visual ativa; leitura do jungler falhou: ${error.message}`
        : 'Análise visual ativa; não foi possível ler o jungler.'
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
      { left: 0.955, width: 0.043, top: 0, height: 0.032, name: 'HUD superior direito' },
      { left: 0.955, width: 0.043, top: 0.006, height: 0.032, name: 'HUD superior direito (ajuste vertical)' }
    ] as const
    let seconds: number | null = null
    const readings: string[] = []
    const clockReadings: typeof lastClockReadings = []

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
      clockReadings.push({
        region: clockRegion.name,
        text: result.text,
        confidence: result.confidence,
        parsedSeconds: parsed
      })
      readings.push(`${clockRegion.name}: ${result.text.trim() || 'sem leitura'}`)
      if (parsed !== null && parsed <= 99 * 60 + 59) {
        seconds = parsed
        break
      }
    }
    lastClockReadings = clockReadings

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
    if (laneDetectionEnabled && !rosterPromptAnnounced) {
      rosterPromptAnnounced = true
      announceEvent('Os oponentes e suas posições são consultados automaticamente pela API local.')
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
  const side = Math.round(screen.width * minimapCrop.size)
  const centerX = screen.width * minimapCrop.x
  const centerY = screen.height * minimapCrop.y
  return {
    left: Math.max(0, Math.round(centerX - side / 2)),
    top: Math.max(0, Math.round(centerY - side / 2)),
    right: Math.min(screen.width, Math.round(centerX + side / 2)),
    bottom: Math.min(screen.height, Math.round(centerY + side / 2))
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
  if (captureProfile !== activeCaptureProfile) {
    minimapCrop = loadMinimapCrop(video.videoWidth, video.videoHeight)
    if (calibrationDialog.open) {
      calibrationSizeControl.value = String(minimapCrop.size)
      drawCalibrationPreview()
    }
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

function findLanePlayer(lane: Lane): EnemyPlayer | undefined {
  const rosterLane: TeamLane = lane === 'bot' ? 'adc' : lane
  return enemyPlayers.find(
    (player) =>
      player.lane === rosterLane &&
      player.laneSource !== 'unknown' &&
      player.portrait !== null
  )
}

function laneAlertState(lane: Lane, now: number): string {
  const watch = laneWatches[lane]
  if (watch.alerted) return 'alertado'
  if (!watch.hasBeenSeen) return 'aguardando primeira detecção'
  if (watch.missingSince === null) return 'sem ausência ativa'
  if (now - watch.missingSince <= missingAlertDelay) return 'aguardando 5s'
  if (!findLanePlayer(lane)) return 'jogador da lane não encontrado no roster'
  return 'pronto para alertar'
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
      const player = findLanePlayer(lane)
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

function defaultMinimapCrop(width = 1920, height = 1080): MinimapCrop {
  const size = Math.min(0.13, (height * 0.235) / width)
  return {
    x: 1 - 0.008 - size / 2,
    y: 1 - 0.005 - (size * width) / (2 * height),
    size
  }
}

function loadMinimapCrop(width: number, height: number): MinimapCrop {
  activeCaptureProfile = `${width}x${height}`
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

function saveMinimapCrop(): void {
  try {
    if (!activeCaptureProfile) {
      throw new Error('No active capture resolution is available for the minimap profile.')
    }
    localStorage.setItem(
      `${minimapCropStorageKey}:${activeCaptureProfile}`,
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
      'Inicie a captura para ajustar o minimapa.'
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

calibrateMinimapControl.addEventListener('click', () => {
  calibrationDialog.showModal()
  calibrationSizeControl.min = '0.05'
  calibrationSizeControl.max = '0.3'
  calibrationSizeControl.step = '0.005'
  calibrationSizeControl.value = String(minimapCrop.size)
  drawCalibrationPreview()
})

calibrationSizeControl.addEventListener('input', () => {
  minimapCrop.size = Number(calibrationSizeControl.value)
  saveMinimapCrop()
  drawCalibrationPreview()
})

resetCalibrationButton.addEventListener('click', () => {
  minimapCrop = video
    ? defaultMinimapCrop(video.videoWidth, video.videoHeight)
    : defaultMinimapCrop()
  calibrationSizeControl.value = String(minimapCrop.size)
  saveMinimapCrop()
  calibrationFeedbackElement.textContent = 'Posições padrão restauradas.'
  drawCalibrationPreview()
})

calibrationCanvas.addEventListener('pointerdown', (event) => {
  if (!video) return
  const point = calibrationPointFromEvent(event)
  if (!point) return
  const halfSize = (minimapCrop.size * video.videoWidth) / 2
  if (
    Math.abs(point.x - minimapCrop.x * video.videoWidth) > halfSize ||
    Math.abs(point.y - minimapCrop.y * video.videoHeight) > halfSize
  ) {
    return
  }
  calibrationDragOffset = {
    x: point.x - minimapCrop.x * video.videoWidth,
    y: point.y - minimapCrop.y * video.videoHeight
  }
  isDraggingMinimapCrop = true
  calibrationCanvas.setPointerCapture(event.pointerId)
  event.preventDefault()
})

calibrationCanvas.addEventListener('pointermove', (event) => {
  if (!isDraggingMinimapCrop || !video) return
  const point = calibrationPointFromEvent(event)
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
})

function finishCalibrationDrag(): void {
  isDraggingMinimapCrop = false
}

calibrationCanvas.addEventListener('pointerup', finishCalibrationDrag)
calibrationCanvas.addEventListener('pointercancel', finishCalibrationDrag)

function analyzeFrame(): void {
  drawPreview()
  if (screen.width > 0 && screen.height > 0) {
    region = estimateMinimapRegion()
  }
  updateDiagnosticPanel()
  if (calibrationDialog.open) drawCalibrationPreview()
  void inspectJungler()
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
  updateDiagnosticPanel()
}

function stopCapture(): void {
  if (timer === null && stream === null) return
  if (timer !== null) {
    window.clearInterval(timer)
    timer = null
  }
  if (rosterRefreshTimer !== null) {
    window.clearInterval(rosterRefreshTimer)
    rosterRefreshTimer = null
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
  setDiagnosticMode(diagnosticMode)
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
    minimapCrop = loadMinimapCrop(video.videoWidth, video.videoHeight)
    captureDiagnosticControl.disabled = false
    await window.companion.setOverlayActive(true)
    drawPreview()
    updateDiagnosticPanel()
    region = estimateMinimapRegion()
    resetMatchEvents()
    roster.hidden = false
    rosterStatusElement.textContent = 'Conectando à API local da partida...'
    void refreshLiveClientRoster()
    rosterRefreshTimer = window.setInterval(() => {
      void refreshLiveClientRoster()
    }, liveClientPollInterval)
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
