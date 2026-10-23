/// <reference types="vite/client" />

import championCatalog from '../assets/champions.json'
import type { LiveClientJunglerResult } from '../../shared/live-client-data'
import type { OverlayMarker } from '../../shared/overlay'
import type { RiotSyncRequest, RiotSyncResponse } from '../../shared/riot-sync'
import {
  classifyJungleZone,
  formatJungleZone,
  type JungleZone,
  type MapSide
} from './jungle-zones'
import { initializeRankedCalendar } from './ranked-calendar'

export {}

declare global {
  interface Window {
    companion: {
      version: string
      minimizeWindow: () => Promise<void>
      toggleMaximizeWindow: () => Promise<boolean>
      closeWindow: () => Promise<void>
      setOverlayActive: (active: boolean) => Promise<void>
      setOverlayMarker: (marker: OverlayMarker | null) => Promise<void>
      publishOverlayAlert: (title: string) => void
      notifyOverlayReady: () => void
      onOverlayMarker: (callback: (marker: OverlayMarker | null) => void) => () => void
      onOverlayAlert: (callback: (title: string) => void) => () => void
      findLeagueWindows: () => Promise<Array<{ id: string; name: string }>>
      selectLeagueWindow: (sourceId: string) => Promise<boolean>
      readLiveClientJungler: () => Promise<LiveClientJunglerResult>
      syncRiotRankedMatches: (request: RiotSyncRequest) => Promise<RiotSyncResponse>
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

const windowTitlebar = document.querySelector<HTMLElement>('.window-titlebar')
const minimizeWindowButton = document.querySelector<HTMLButtonElement>('#window-minimize')
const maximizeWindowButton = document.querySelector<HTMLButtonElement>('#window-maximize')
const closeWindowButton = document.querySelector<HTMLButtonElement>('#window-close')
const startButton = document.querySelector<HTMLButtonElement>('#start-button')
const stopButton = document.querySelector<HTMLButtonElement>('#stop-button')
const screenCanvas = document.querySelector<HTMLCanvasElement>('#screen-canvas')
const status = document.querySelector<HTMLParagraphElement>('#status')
const junglerCard = document.querySelector<HTMLElement>('#jungler-card')
const junglerPortraitImage = document.querySelector<HTMLImageElement>('#jungler-portrait')
const junglerLocationText = document.querySelector<HTMLElement>('#jungler-location')
const junglerStatus = document.querySelector<HTMLElement>('#jungler-status')
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
const developerTools = document.querySelector<HTMLElement>('#developer-tools')
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
  !windowTitlebar ||
  !minimizeWindowButton ||
  !maximizeWindowButton ||
  !closeWindowButton ||
  !startButton ||
  !stopButton ||
  !screenCanvas ||
  !status ||
  !junglerCard ||
  !junglerPortraitImage ||
  !junglerLocationText ||
  !junglerStatus ||
  !calibrateMinimapButton ||
  !minimapCalibrationDialog ||
  !calibrationPreview ||
  !calibrationSizeInput ||
  !resetCalibrationButton ||
  !calibrationFeedback ||
  !calibrationResolution ||
  !diagnosticModeButton ||
  !developerTools ||
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

const screen = screenCanvas
const captureStatus = status
const startCaptureButton = startButton
const stopCaptureButton = stopButton
const jungleCard = junglerCard
const junglePortrait = junglerPortraitImage
const jungleLocation = junglerLocationText
const junglerStatusElement = junglerStatus
const calibrationCanvas = calibrationPreview
const calibrationDialog = minimapCalibrationDialog
const calibrateMinimapControl = calibrateMinimapButton
const calibrationSizeControl = calibrationSizeInput
const calibrationFeedbackElement = calibrationFeedback
const calibrationResolutionElement = calibrationResolution
const diagnosticModeControl = diagnosticModeButton
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

function runWindowControl(action: () => Promise<unknown>): void {
  void action().catch((error: unknown) => {
    console.error('Could not apply the requested window control.', error)
    setStatus('Não foi possível alterar a janela.')
  })
}

minimizeWindowButton.addEventListener('click', () => {
  runWindowControl(() => window.companion.minimizeWindow())
})

maximizeWindowButton.addEventListener('click', () => {
  runWindowControl(async () => {
    const maximized = await window.companion.toggleMaximizeWindow()
    maximizeWindowButton.setAttribute('aria-label', maximized ? 'Restaurar janela' : 'Maximizar janela')
    document.body.classList.toggle('window-maximized', maximized)
  })
})

closeWindowButton.addEventListener('click', () => {
  runWindowControl(() => window.companion.closeWindow())
})

windowTitlebar.addEventListener('dblclick', (event) => {
  if ((event.target as HTMLElement).closest('.window-titlebar-controls')) return
  maximizeWindowButton.click()
})
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
type AlertVoicePreferences = { voiceURI: string; rate: number; pitch: number }
const piperVoiceLabels = {
  'pt_BR-faber-medium': 'Faber',
  'pt_BR-cadu-medium': 'Cadu',
  'pt_BR-jeff-medium': 'Jeff'
} as const
type PiperVoiceId = keyof typeof piperVoiceLabels
class VoiceSelectionChangedError extends Error {
  constructor() {
    super('A voz selecionada foi alterada.')
    this.name = 'AbortError'
  }
}
type VoiceWorkerRequest =
  | { type: 'prepare'; requestId: number; voiceId: PiperVoiceId; allowDownload: boolean }
  | { type: 'synthesize'; requestId: number; voiceId: PiperVoiceId; text: string }
type VoiceEngineRequest =
  | { type: 'prepare'; allowDownload: boolean }
  | { type: 'synthesize'; text: string }
type VoiceWorkerResponse =
  | { type: 'progress'; requestId: number; loaded: number; total: number }
  | { type: 'ready'; requestId: number }
  | { type: 'audio'; requestId: number; blob: Blob }
  | { type: 'error'; requestId: number; message: string }
type ChampionDefinition = { id: string; name: string }
type ChampionTemplate = ChampionDefinition & { url: string }
type MinimapCrop = { x: number; y: number; size: number }
type MinimapScanDiagnostics = {
  status: 'not-run' | 'no-red-ring' | 'no-valid-match' | 'score-too-high' | 'ambiguous' | 'found'
  point: Point | null
  iconSize: number | null
  zone: JungleZone | null
  bestScore: number | null
  runnerUpScore: number | null
  redRingSamples: number
}
type JunglerTarget = {
  championId: string
  championName: string
  portrait: ImageData
  portraitUrl: string
}
const jungleScanInterval = 125
const jungleMatchConfirmationScans = 2
const jungleMatchPositionTolerance = 0.08
const jungleMatchInstantScore = 0.1
const jungleMatchInstantRingSamples = 9
const jungleMatchInstantMargin = 0.03
const jungleZoneChangeConfirmationMs = 1_250
const jungleZoneAnnouncementCooldownMs = 5_000
const liveClientPollInterval = 2500
const voidGrubAlertTime = 7 * 60
const voidGrubSpawnTime = 8 * 60
const minimapRingSamplePoints = Array.from({ length: 16 }, (_, index) => {
  const angle = (index * 2 * Math.PI) / 16
  return [0.5 + Math.cos(angle) * 0.46, 0.5 + Math.sin(angle) * 0.46]
})
const jungleMatchMaximumScore = 0.17
const jungleMatchMinimumMargin = 0.015
const jungleMatchMinimumRingSamples = 5
const minimapCropStorageKey = 'league-event-companion.minimap-crops.v1'
const alertVoiceStorageKey = 'bronx-analytics.alert-voice.v2'
const legacyAlertVoiceStorageKey = 'bronx-analytics.alert-voice.v1'
let stream: MediaStream | null = null
let video: HTMLVideoElement | null = null
let timer: number | null = null
let selectedWindowId: string | null = null
let discoveryTimer: number | null = null
let discoveryInProgress = false
let clockTimer: number | null = null
let clockReadInProgress = false
let clockReaderReady = false
let rosterRefreshTimer: number | null = null
let rosterRefreshInProgress = false
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
let pendingJunglePoint: Point | null = null
let pendingJungleZoneScans = 0
let announcedJungleZone: JungleZone | null = null
let jungleZoneAlertCandidate: JungleZone | null = null
let jungleZoneAlertCandidateSince = 0
let lastJungleZoneAnnouncementAt = 0
let lastConfirmedJungleZone: JungleZone | null = null
let lastConfirmedJungleMarker: OverlayMarker | null = null
let jungleDisappearanceAnnounced = false
let jungleMissedScans = 0
let trackedJungler: JunglerTarget | null = null
let jungleCaptureAnnounced = false
let isDraggingMinimapCrop = false
let calibrationDragOffset: Point = { x: 0, y: 0 }
let championTemplates: ChampionTemplate[] | null = null
let championTemplatesPromise: Promise<ChampionTemplate[]> | null = null
let activeCaptureProfile = ''
let minimapCrop = defaultMinimapCrop()
let diagnosticMode = false
let alertVoiceStorageWarning: string | null = null
let alertVoicePreferences: AlertVoicePreferences = {
  voiceURI: 'piper:pt_BR-jeff-medium',
  rate: 1,
  pitch: 1
}
let voiceEngineWorker: Worker | null = null
let voiceEngineWorkerVoiceId: PiperVoiceId | null = null
let voiceEngineRequestId = 0
let voiceEngineRequests = new Map<
  number,
  { resolve: (blob: Blob | null) => void; reject: (error: Error) => void }
>()
let voiceAudioContext: AudioContext | null = null
let activePiperAudio: AudioBufferSourceNode | null = null
let lastJungleScanDiagnostics: MinimapScanDiagnostics = {
  status: 'not-run',
  point: null,
  iconSize: null,
  zone: null,
  bestScore: null,
  runnerUpScore: null,
  redRingSamples: 0
}

function loadAlertVoicePreferences(): void {
  try {
    const savedPreferences = window.localStorage.getItem(alertVoiceStorageKey)
    const legacyPreferences = savedPreferences
      ? null
      : window.localStorage.getItem(legacyAlertVoiceStorageKey)
    const saved = savedPreferences ?? legacyPreferences
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
      voiceURI: legacyPreferences
        ? 'piper:pt_BR-jeff-medium'
        : parsed.voiceURI,
      rate: Math.min(1.25, Math.max(0.75, parsed.rate)),
      pitch: Math.min(1.3, Math.max(0.7, parsed.pitch))
    }
    if (legacyPreferences) {
      window.localStorage.setItem(alertVoiceStorageKey, JSON.stringify(alertVoicePreferences))
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

function piperVoiceFromURI(uri: string): PiperVoiceId | null {
  if (!uri.startsWith('piper:')) return null
  const voiceId = uri.slice('piper:'.length)
  return Object.hasOwn(piperVoiceLabels, voiceId) ? (voiceId as PiperVoiceId) : null
}

function rejectVoiceEngineRequests(error: Error): void {
  for (const request of voiceEngineRequests.values()) request.reject(error)
  voiceEngineRequests.clear()
}

function getVoiceEngineWorker(voiceId: PiperVoiceId): Worker {
  if (voiceEngineWorker && voiceEngineWorkerVoiceId !== voiceId) {
    voiceEngineWorker.terminate()
    rejectVoiceEngineRequests(new Error('A voz selecionada foi alterada.'))
    voiceEngineWorker = null
    voiceEngineWorkerVoiceId = null
  }
  if (voiceEngineWorker) return voiceEngineWorker

  const worker = new Worker(new URL('./voice-engine.ts', import.meta.url), {
    type: 'module'
  })
  voiceEngineWorker = worker
  voiceEngineWorkerVoiceId = voiceId
  worker.addEventListener('message', (event: MessageEvent<VoiceWorkerResponse>) => {
    const response = event.data
    if (response.type === 'progress') {
      const progress = Math.round((response.loaded / response.total) * 100)
      const downloadedMegabytes = (response.loaded / 1_000_000).toFixed(1)
      voiceSettingsStatusElement.textContent =
        `Baixando a voz ${piperVoiceLabels[voiceId]}: ${progress}% (${downloadedMegabytes} MB).`
      return
    }
    const pending = voiceEngineRequests.get(response.requestId)
    if (!pending) return
    voiceEngineRequests.delete(response.requestId)
    if (response.type === 'error') {
      pending.reject(new Error(response.message))
    } else if (response.type === 'audio') {
      pending.resolve(response.blob)
    } else {
      pending.resolve(null)
    }
  })
  worker.addEventListener('error', (event) => {
    console.error('Local Piper worker failed.', event.message)
    rejectVoiceEngineRequests(new Error('O mecanismo de voz local falhou.'))
    if (voiceEngineWorker === worker) {
      voiceEngineWorker = null
      voiceEngineWorkerVoiceId = null
    }
  })
  return worker
}

function requestVoiceEngine(
  voiceId: PiperVoiceId,
  request: VoiceEngineRequest
): Promise<Blob | null> {
  const worker = getVoiceEngineWorker(voiceId)
  const requestId = ++voiceEngineRequestId
  return new Promise((resolve, reject) => {
    voiceEngineRequests.set(requestId, { resolve, reject })
    worker.postMessage({ ...request, requestId, voiceId })
  })
}

async function playPiperAudio(blob: Blob, onEnded?: () => void): Promise<void> {
  voiceAudioContext ??= new AudioContext()
  if (voiceAudioContext.state === 'suspended') await voiceAudioContext.resume()
  const buffer = await voiceAudioContext.decodeAudioData(await blob.arrayBuffer())
  stopPiperAudio()

  const source = voiceAudioContext.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = alertVoicePreferences.rate
  source.detune.value =
    1200 * Math.log2(alertVoicePreferences.pitch / alertVoicePreferences.rate)
  source.connect(voiceAudioContext.destination)
  source.addEventListener(
    'ended',
    () => {
      if (activePiperAudio === source) {
        activePiperAudio = null
        onEnded?.()
      }
    },
    { once: true }
  )
  activePiperAudio = source
  source.start()
}

function stopPiperAudio(): void {
  const source = activePiperAudio
  activePiperAudio = null
  if (source) source.stop()
}

function speakPiperLocally(text: string, voiceId: PiperVoiceId): void {
  void requestVoiceEngine(voiceId, { type: 'prepare', allowDownload: false })
    .then(() => requestVoiceEngine(voiceId, { type: 'synthesize', text }))
    .then(async (blob) => {
      if (!blob) throw new Error('O mecanismo local não retornou áudio.')
      await playPiperAudio(blob)
    })
    .catch((error: unknown) => {
      if (error instanceof VoiceSelectionChangedError) return
      console.error('Local Piper alert speech failed.', error)
      voiceSettingsStatusElement.textContent =
        'A voz Piper ainda não está disponível; o alerta usará a voz local do sistema.'
      speakWithSystemVoice(text)
    })
}

function speakWithSystemVoice(text: string): void {
  if (!('speechSynthesis' in window)) {
    voiceSettingsStatusElement.textContent =
      'A voz local não está disponível neste dispositivo; os alertas visuais continuam ativos.'
    return
  }
  try {
    window.speechSynthesis.speak(createAlertUtterance(text))
  } catch (error) {
    console.error('System alert speech failed.', error)
    voiceSettingsStatusElement.textContent =
      'Não foi possível reproduzir a voz local; os alertas visuais continuam ativos.'
  }
}

function speakLocally(text: string): void {
  const piperVoiceId = piperVoiceFromURI(alertVoicePreferences.voiceURI)
  if (piperVoiceId) {
    speakPiperLocally(text, piperVoiceId)
    return
  }
  if (!('speechSynthesis' in window)) {
    throw new Error('A síntese de voz local não está disponível.')
  }
  if (alertVoicePreferences.voiceURI && !selectedAlertVoice()) {
    throw new Error('A voz local selecionada não está mais disponível.')
  }
  window.speechSynthesis.speak(createAlertUtterance(text))
}

function selectedAlertVoice(): SpeechSynthesisVoice | null {
  if (
    !('speechSynthesis' in window) ||
    !alertVoicePreferences.voiceURI ||
    piperVoiceFromURI(alertVoicePreferences.voiceURI)
  ) {
    return null
  }
  return window.speechSynthesis
    .getVoices()
    .find((voice) => voice.voiceURI === alertVoicePreferences.voiceURI) ?? null
}

function refreshAlertVoices(): void {
  const hasSystemSpeech = 'speechSynthesis' in window
  const voices = hasSystemSpeech ? window.speechSynthesis.getVoices() : []
  const selectedUri = alertVoicePreferences.voiceURI
  const fragment = document.createDocumentFragment()
  const automaticOption = document.createElement('option')
  automaticOption.value = ''
  automaticOption.textContent = 'Automática (Português do sistema)'
  fragment.append(automaticOption)
  const piperGroup = document.createElement('optgroup')
  piperGroup.label = 'Piper · offline · pt-BR · CC0'
  for (const [voiceId, voiceName] of Object.entries(piperVoiceLabels)) {
    const option = document.createElement('option')
    option.value = `piper:${voiceId}`
    option.textContent = `${voiceName} (Piper, qualidade média)`
    piperGroup.append(option)
  }
  fragment.append(piperGroup)
  for (const voice of voices) {
    const option = document.createElement('option')
    option.value = voice.voiceURI
    option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' · padrão' : ''}`
    fragment.append(option)
  }
  alertVoiceControl.replaceChildren(fragment)
  if (
    piperVoiceFromURI(selectedUri) ||
    (selectedUri && voices.some((voice) => voice.voiceURI === selectedUri))
  ) {
    alertVoiceControl.value = selectedUri
  } else if (selectedUri) {
    alertVoicePreferences.voiceURI = ''
    alertVoiceControl.value = ''
  }
  const selectedPiperVoice = piperVoiceFromURI(selectedUri)
  testVoiceControl.disabled = !hasSystemSpeech && !selectedPiperVoice
  if (selectedPiperVoice) {
    voiceSettingsStatusElement.textContent =
      `Piper ${piperVoiceLabels[selectedPiperVoice]} sintetiza localmente. A primeira prévia baixa o modelo (~63 MB); depois, não precisa de internet.`
  } else if (!hasSystemSpeech) {
    voiceSettingsStatusElement.textContent =
      'Vozes do sistema não estão disponíveis; selecione uma voz Piper pt-BR para usar síntese offline.'
  } else if (voices.length === 0) {
    voiceSettingsStatusElement.textContent =
      'Nenhuma voz do sistema foi listada. As vozes Piper pt-BR continuam disponíveis para uso offline.'
  } else {
    voiceSettingsStatusElement.textContent =
      `${voices.length} voz(es) do sistema disponíveis. Piper também oferece três vozes pt-BR que funcionam offline.`
  }
  if (alertVoiceStorageWarning) {
    voiceSettingsStatusElement.textContent += ` ${alertVoiceStorageWarning}`
  }
}

function createAlertUtterance(text: string): SpeechSynthesisUtterance {
  const utterance = new SpeechSynthesisUtterance(text)
  const voice = selectedAlertVoice() ??
    window.speechSynthesis.getVoices().find((entry) =>
      entry.lang.toLocaleLowerCase().startsWith('pt-br')
    ) ?? null
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

alertVoiceControl.addEventListener('change', () => {
  const previousVoiceId = piperVoiceFromURI(alertVoicePreferences.voiceURI)
  alertVoicePreferences.voiceURI = alertVoiceControl.value
  persistAlertVoicePreferences()
  const nextVoiceId = piperVoiceFromURI(alertVoicePreferences.voiceURI)
  testVoiceControl.disabled = !('speechSynthesis' in window) && !nextVoiceId
  if (previousVoiceId !== nextVoiceId) stopPiperAudio()
  if (previousVoiceId !== nextVoiceId && voiceEngineWorker) {
    voiceEngineWorker.terminate()
    voiceEngineWorker = null
    voiceEngineWorkerVoiceId = null
    rejectVoiceEngineRequests(new VoiceSelectionChangedError())
  }
  if (nextVoiceId) {
    voiceSettingsStatusElement.textContent =
      `Piper ${piperVoiceLabels[nextVoiceId]} sintetiza localmente. A primeira prévia baixa o modelo (~63 MB); depois, não precisa de internet.`
    return
  }
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
  const piperVoiceId = piperVoiceFromURI(alertVoicePreferences.voiceURI)
  if (piperVoiceId) {
    window.speechSynthesis?.cancel()
    stopPiperAudio()
    testVoiceControl.disabled = true
    voiceSettingsStatusElement.textContent =
      `Preparando a voz ${piperVoiceLabels[piperVoiceId]} localmente...`
    void requestVoiceEngine(piperVoiceId, {
      type: 'prepare',
      allowDownload: true
    })
      .then(() =>
        requestVoiceEngine(piperVoiceId, {
          type: 'synthesize',
          text: 'Prévia de voz. O jungler inimigo foi localizado.'
        })
      )
      .then(async (blob) => {
        if (!blob) throw new Error('O mecanismo local não retornou áudio.')
        voiceSettingsStatusElement.textContent = `Reproduzindo prévia: ${piperVoiceLabels[piperVoiceId]}.`
        await playPiperAudio(blob, () => {
          voiceSettingsStatusElement.textContent = 'Prévia concluída.'
        })
      })
      .catch((error: unknown) => {
        if (error instanceof VoiceSelectionChangedError) return
        console.error('Piper voice preview failed.', error)
        voiceSettingsStatusElement.textContent =
          'Não foi possível reproduzir a prévia. Confira a conexão e tente novamente.'
      })
      .finally(() => {
        testVoiceControl.disabled = false
      })
    return
  }
  if (!('speechSynthesis' in window)) {
    voiceSettingsStatusElement.textContent = 'A síntese de voz não está disponível.'
    return
  }
  if (alertVoicePreferences.voiceURI && !selectedAlertVoice()) {
    voiceSettingsStatusElement.textContent =
      'A voz selecionada não está mais disponível. Escolha outra voz na lista.'
    return
  }
  stopPiperAudio()
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

function announceEvent(titleText: string): void {
  window.companion.publishOverlayAlert(titleText)
  if (diagnosticMode) return

  if ('speechSynthesis' in window || piperVoiceFromURI(alertVoicePreferences.voiceURI)) {
    try {
      speakLocally(titleText)
    } catch (error) {
      console.error('Local alert speech failed.', error)
      voiceSettingsStatusElement.textContent =
        'Não foi possível reproduzir o alerta. Confira as configurações de voz e tente novamente.'
    }
  }
}

function setOverlayLastSeenMarker(marker: OverlayMarker | null): void {
  void window.companion.setOverlayMarker(marker).catch((error: unknown) => {
    console.error('Could not update the last-seen minimap marker.', error)
    setStatus('O rastreamento segue ativo, mas não foi possível atualizar o marcador no minimapa.')
  })
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

setDiagnosticMode(false)

diagnosticModeControl.addEventListener('click', () => {
  setDiagnosticMode(!diagnosticMode)
})

function resetMatchEvents(): void {
  voidGrubAlertAnnounced = false
  lastRecognizedClock = null
  stableClockCandidate = null
  stableClockSamples = 0
  lastClockSampleAt = 0
  lastClockReadings = []
  junglePortraitTemplate = null
  lastJungleScanAt = 0
  pendingJungleZone = null
  pendingJunglePoint = null
  pendingJungleZoneScans = 0
  announcedJungleZone = null
  jungleZoneAlertCandidate = null
  jungleZoneAlertCandidateSince = 0
  lastJungleZoneAnnouncementAt = 0
  lastConfirmedJungleZone = null
  lastConfirmedJungleMarker = null
  jungleDisappearanceAnnounced = false
  jungleMissedScans = 0
  setOverlayLastSeenMarker(null)
  ownTeamSide = null
  jungleCaptureAnnounced = false
  trackedJungler = null
  junglerStatusElement.textContent = 'Aguardando identificar o jungler adversário.'
  jungleCard.hidden = false
  junglePortrait.removeAttribute('src')
  junglePortrait.hidden = true
  jungleLocation.textContent = stream
    ? 'Aguardando a API local identificar o jungler.'
    : 'Inicie a captura para acompanhar o jungler desta partida.'
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

async function applyLiveClientJungler(result: LiveClientJunglerResult): Promise<void> {
  if (result.status === 'unavailable') {
    console.error('The local League client did not return jungler data.', result.message)
    junglerStatusElement.textContent =
      'Não foi possível identificar o jungler. Confirme que a partida está ativa.'
    return
  }
  ownTeamSide = result.ownTeamSide
  if (!result.jungler) {
    clearTrackedJungler()
    junglerStatusElement.textContent =
      'A partida foi conectada, mas não foi possível identificar um único jungler adversário.'
    return
  }

  const champion = championFromLiveName(result.jungler.championName)
  if (!champion) {
    clearTrackedJungler()
    junglerStatusElement.textContent =
      'O jungler foi identificado, mas o retrato dele não está disponível.'
    return
  }
  if (!(await assignJunglerChampion(champion.id))) return
  junglerStatusElement.textContent =
    `Rastreando apenas ${champion.name}; identificado ${
      result.jungler.source === 'smite'
        ? 'pelo feitiço Golpear'
        : 'pela posição informada na partida'
    }.`
}

async function refreshLiveClientJungler(): Promise<void> {
  if (!stream || rosterRefreshInProgress) return
  const requestedStream = stream
  rosterRefreshInProgress = true
  try {
    const result = await window.companion.readLiveClientJungler()
    if (stream === requestedStream) await applyLiveClientJungler(result)
  } catch (error) {
    console.error('Could not identify the enemy jungler from the local League client.', error)
    junglerStatusElement.textContent =
      'Não foi possível identificar o jungler nesta partida.'
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

async function assignJunglerChampion(championId: string): Promise<boolean> {
  try {
    if (trackedJungler?.championId === championId) return true
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
    trackedJungler = {
      championId: selected.id,
      championName: selected.name,
      portraitUrl: selected.url,
      portrait: portraitContext!.getImageData(0, 0, portraitCanvas.width, portraitCanvas.height)
    }
    resetJunglerTracking()
    junglePortrait.hidden = false
    junglePortrait.src = selected.url
    jungleLocation.textContent = 'Ícone do jungler carregado; procurando no minimapa.'
    if (!jungleCaptureAnnounced) {
      jungleCaptureAnnounced = true
      announceEvent('Jungler identificado; buscando apenas o ícone dele no minimapa.')
    }
    return true
  } catch (error) {
    console.error('Could not load the enemy jungler portrait.', error)
    clearTrackedJungler()
    junglerStatusElement.textContent = 'Não foi possível carregar o retrato do jungler.'
    return false
  }
}

function resetJunglerTracking(): void {
  jungleCaptureAnnounced = false
  lastJungleScanAt = 0
  junglePortraitTemplate = trackedJungler?.portrait ?? null
  pendingJungleZone = null
  pendingJunglePoint = null
  pendingJungleZoneScans = 0
  announcedJungleZone = null
  jungleZoneAlertCandidate = null
  jungleZoneAlertCandidateSince = 0
  lastJungleZoneAnnouncementAt = 0
  lastConfirmedJungleZone = null
  lastConfirmedJungleMarker = null
  jungleDisappearanceAnnounced = false
  jungleMissedScans = 0
  setOverlayLastSeenMarker(null)
}

function clearTrackedJungler(): void {
  trackedJungler = null
  junglePortraitTemplate = null
  junglePortrait.hidden = true
  junglePortrait.removeAttribute('src')
  jungleLocation.textContent = stream
    ? 'Aguardando identificar o jungler adversário.'
    : 'Inicie a captura para acompanhar o jungler desta partida.'
  jungleCaptureAnnounced = false
  resetJunglerTracking()
}

function findPortraitOnMinimap(template: ImageData): MinimapScanDiagnostics {
  const result: MinimapScanDiagnostics = {
    status: 'no-red-ring',
    point: null,
    iconSize: null,
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
  const candidates: Array<{
    score: number
    redRingSamples: number
    x: number
    y: number
    size: number
  }> = []
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
        candidates.push({ score, redRingSamples, x: left, y: top, size })
      }
    }
  }

  candidates.sort((first, second) => first.score - second.score)
  const best = candidates[0]
  result.redRingSamples = best?.redRingSamples ?? maxObservedRingSamples
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
  result.iconSize = best.size / width
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
      iconSize: null,
      zone: null,
      bestScore: null,
      runnerUpScore: null,
      redRingSamples: 0
    }
  }
  return findPortraitOnMinimap(junglePortraitTemplate)
}

function createOverlayMarker(match: MinimapScanDiagnostics): OverlayMarker | null {
  if (!video || !match.point || match.iconSize === null) return null
  const minimap = estimateJunglerMapBounds(video.videoWidth, video.videoHeight)
  const width = minimap.right - minimap.left
  const height = minimap.bottom - minimap.top
  if (width <= 0 || height <= 0) return null
  return {
    x: (minimap.left + match.point.x * width) / video.videoWidth,
    y: (minimap.top + match.point.y * height) / video.videoHeight,
    size: (match.iconSize * width) / video.videoWidth
  }
}

function updateDiagnosticPanel(): void {
  if (!diagnosticMode) return
  const dimensions =
    video && video.videoWidth > 0 && video.videoHeight > 0
      ? `${video.videoWidth}×${video.videoHeight}`
      : 'sem captura'
  const minimap = video ? estimateJunglerMapBounds(video.videoWidth, video.videoHeight) : null
  const lines = [
    `Frame: ${dimensions}`,
    `Jungler: ${junglerStatusElement.textContent ?? 'sem estado'}`,
    `Jungler: ${trackedJungler?.championName ?? 'não identificado'}`,
    `Relógio: ${lastRecognizedClock === null ? 'não lido' : formatElapsed(lastRecognizedClock)}`,
    `OCR bruto: ${lastClockReadings.length > 0
      ? lastClockReadings.map((reading) =>
          `${reading.region}: ${reading.text.trim().replace(/\s+/g, ' ') || 'sem leitura'} (${reading.confidence.toFixed(0)}%)`
        ).join(' | ')
      : 'sem leitura'}`,
    `Perfil de captura: ${activeCaptureProfile || 'aguardando captura'}`,
    `Minimapa: ${minimap ? `x=${minimap.left}, y=${minimap.top}, ${minimap.right - minimap.left}×${minimap.bottom - minimap.top}` : 'indisponível'}`,
    `Lado local: ${ownTeamSide ?? 'não identificado'}`,
    `Campeão do jungler: ${trackedJungler?.championName ?? 'não confirmado'}`,
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
      jungler: trackedJungler
        ? {
            championId: trackedJungler.championId,
            championName: trackedJungler.championName
          }
        : null,
      minimapScan: lastJungleScanDiagnostics,
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
    diagnosticStatusElement.textContent = 'Não foi possível salvar a amostra de diagnóstico.'
  } finally {
    captureDiagnosticControl.disabled = !video
  }
}

captureDiagnosticControl.addEventListener('click', () => {
  void saveDiagnosticSample()
})

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
        iconSize: null,
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
      pendingJunglePoint = null
      pendingJungleZoneScans = 0
      if (jungleMissedScans >= 2) {
        jungleZoneAlertCandidate = null
        jungleZoneAlertCandidateSince = 0
        if (lastConfirmedJungleZone && lastConfirmedJungleMarker) {
          const lastObservedArea = formatJungleZone(
            lastConfirmedJungleZone,
            ownTeamSide
          ).replace(/^Jungler\s+/, '').replace(/\.$/, '')
          jungleLocation.textContent =
            `Jungler não visível; última posição observada: ${lastObservedArea}`
          if (!jungleDisappearanceAnnounced) {
            jungleDisappearanceAnnounced = true
            setOverlayLastSeenMarker(lastConfirmedJungleMarker)
            announceEvent(
              `Jungler desapareceu da visão. Último local observado: ${lastObservedArea}.`
            )
          }
        } else {
          jungleLocation.textContent = 'Retrato pronto; jungler ainda não visível no minimapa.'
        }
      }
      return
    }

    const candidateIsStable =
      pendingJungleZone === match.zone &&
      pendingJunglePoint !== null &&
      Math.hypot(
        match.point.x - pendingJunglePoint.x,
        match.point.y - pendingJunglePoint.y
      ) <= jungleMatchPositionTolerance
    if (candidateIsStable) {
      pendingJungleZoneScans += 1
    } else {
      pendingJungleZone = match.zone
      pendingJunglePoint = match.point
      pendingJungleZoneScans = 1
    }
    const isInstantConfirmation =
      match.bestScore !== null &&
      match.bestScore <= jungleMatchInstantScore &&
      match.redRingSamples >= jungleMatchInstantRingSamples &&
      (match.runnerUpScore === null ||
        match.runnerUpScore - match.bestScore >= jungleMatchInstantMargin)
    if (
      pendingJungleZoneScans < jungleMatchConfirmationScans &&
      !isInstantConfirmation
    ) return

    if (jungleDisappearanceAnnounced) {
      jungleDisappearanceAnnounced = false
      setOverlayLastSeenMarker(null)
    }
    jungleMissedScans = 0

    const message = formatJungleZone(match.zone, ownTeamSide)
    jungleLocation.textContent = `Jungler visível: ${message}`
    lastConfirmedJungleZone = match.zone
    lastConfirmedJungleMarker = createOverlayMarker(match)
    if (announcedJungleZone === match.zone) {
      jungleZoneAlertCandidate = null
      jungleZoneAlertCandidateSince = 0
      return
    }
    if (announcedJungleZone === null) {
      announcedJungleZone = match.zone
      lastJungleZoneAnnouncementAt = Date.now()
      jungleZoneAlertCandidate = null
      jungleZoneAlertCandidateSince = 0
    } else {
      if (jungleZoneAlertCandidate !== match.zone) {
        jungleZoneAlertCandidate = match.zone
        jungleZoneAlertCandidateSince = Date.now()
        return
      }
      if (Date.now() - jungleZoneAlertCandidateSince < jungleZoneChangeConfirmationMs) return
      if (Date.now() - lastJungleZoneAnnouncementAt < jungleZoneAnnouncementCooldownMs) return

      announcedJungleZone = match.zone
      lastJungleZoneAnnouncementAt = Date.now()
      jungleZoneAlertCandidate = null
      jungleZoneAlertCandidateSince = 0
    }
    const isLaneApproach =
      match.zone === 'top-lane' ||
      match.zone === 'mid-lane' ||
      match.zone === 'bot-lane'
    announceEvent(
      isLaneApproach
        ? `${message} Possível ameaça de gank; intenção não confirmada.`
        : message
    )
  } catch (error) {
    console.error('Could not inspect the enemy jungler on the minimap.', error)
    setStatus('A análise visual está ativa, mas não foi possível ler o jungler nesta captura.')
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
    setStatus('A detecção está ativa, mas não foi possível ler o relógio da partida.')
  } finally {
    clockReadInProgress = false
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
    void inspectJungler()
  }
  updateDiagnosticPanel()
  if (calibrationDialog.open) drawCalibrationPreview()
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
    setStatus('Não foi possível localizar a janela do jogo.')
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
    setStatus('Não foi possível selecionar essa janela do jogo.')
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
      video: { frameRate: 8 },
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
    resetMatchEvents()
    junglerStatusElement.textContent = 'Conectando à API local da partida...'
    void refreshLiveClientJungler()
    rosterRefreshTimer = window.setInterval(() => {
      void refreshLiveClientJungler()
    }, liveClientPollInterval)
    stream.getVideoTracks()[0]?.addEventListener('ended', stopCapture)
    stopCaptureButton.disabled = false
    timer = window.setInterval(analyzeFrame, 125)
    analyzeFrame()

    try {
      await window.companion.initializeGameOcr()
      if (!stream) return
      clockReaderReady = true
      setStatus('Lendo o cronômetro do jogo para avisos de objetivos.')
      clockTimer = window.setInterval(() => {
        void readGameClock()
      }, 750)
      void readGameClock()
    } catch (error) {
      console.error('Could not initialize the local OCR engine.', error)
      setStatus('A detecção visual está ativa, mas a leitura do relógio está indisponível.')
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
      setStatus('Não foi possível capturar a janela do jogo.')
    }
    if (selectedWindowId) await selectGameWindow(selectedWindowId)
  }
})

stopCaptureButton.addEventListener('click', stopCapture)

initializeRankedCalendar()
void discoverGameWindow()
