import { PATH_MAP, TtsSession } from '@mintplex-labs/piper-tts-web'
import piperDataUrl from '@diffusionstudio/piper-wasm/build/piper_phonemize.data?url'
import piperWasmUrl from '@diffusionstudio/piper-wasm/build/piper_phonemize.wasm?url'
import onnxWasmUrl from '../../../node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm?url'

const voices = {
  'pt_BR-faber-medium': {
    directory: 'faber',
    size: 63_201_294,
    sha256: '858555e3a064209c57088fe6bd70c4c3dc54d03eaa00c45d5ecaf43a33f95aa7'
  },
  'pt_BR-cadu-medium': {
    directory: 'cadu',
    size: 62_950_044,
    sha256: '765f0809a6ea9035d4a6d0d008dbf8876e68b2dd32029312672fa8f405bdb535'
  },
  'pt_BR-jeff-medium': {
    directory: 'jeff',
    size: 62_950_044,
    sha256: '3a6f4c46355813c2b7bbc4d16b6d13d60ed72074b952a393baace82a7d0c94b5'
  }
} as const

type PiperVoiceId = keyof typeof voices
type VoiceWorkerRequest =
  | { type: 'prepare'; requestId: number; voiceId: PiperVoiceId; allowDownload: boolean }
  | { type: 'synthesize'; requestId: number; voiceId: PiperVoiceId; text: string }

type VoiceWorkerResponse =
  | { type: 'progress'; requestId: number; loaded: number; total: number }
  | { type: 'ready'; requestId: number }
  | { type: 'audio'; requestId: number; blob: Blob }
  | { type: 'error'; requestId: number; message: string }
type PiperModelConfig = Record<string, unknown> & {
  audio: Record<string, unknown> & { sample_rate: number }
  espeak: Record<string, unknown> & { voice: string }
  speaker_id_map?: Record<string, number>
}

const modelRevision = '5041a7a49ae5b3a0f30e6837769eb03fdbb231bd'
const modelBaseUrl = `https://huggingface.co/rhasspy/piper-voices/resolve/${modelRevision}/pt/pt_BR`
let activeVoiceId: PiperVoiceId | null = null
let session: TtsSession | null = null
let queuedWork = Promise.resolve()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === 'number')
}

function isPiperModelConfig(value: unknown): value is PiperModelConfig {
  return (
    isRecord(value) &&
    isRecord(value.audio) &&
    typeof value.audio.sample_rate === 'number' &&
    isRecord(value.espeak) &&
    typeof value.espeak.voice === 'string' &&
    (value.speaker_id_map === undefined || isNumberRecord(value.speaker_id_map))
  )
}

function parseModelConfig(text: string): PiperModelConfig {
  const config: unknown = JSON.parse(text)
  if (!isPiperModelConfig(config)) throw new Error('A configuração baixada da voz é inválida.')
  return {
    ...config,
    speaker_id_map: config.speaker_id_map ?? {}
  }
}

function post(response: VoiceWorkerResponse): void {
  self.postMessage(response)
}

function isVoiceId(value: string): value is PiperVoiceId {
  return Object.hasOwn(voices, value)
}

function modelFiles(voiceId: PiperVoiceId): {
  modelFile: string
  configFile: string
  modelUrl: string
  configUrl: string
} {
  const modelFile = `pt_BR-${voiceId.split('-')[1]}-medium.onnx`
  const configFile = `${modelFile}.json`
  const directory = voices[voiceId].directory
  const base = `${modelBaseUrl}/${directory}/medium`
  return {
    modelFile,
    configFile,
    modelUrl: `${base}/${modelFile}`,
    configUrl: `${base}/${configFile}`
  }
}

async function cachedFile(filename: string): Promise<File | null> {
  try {
    const root = await navigator.storage.getDirectory()
    const directory = await root.getDirectoryHandle('piper')
    const handle = await directory.getFileHandle(filename)
    return handle.getFile()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return null
    throw error
  }
}

async function cacheFile(filename: string, blob: Blob): Promise<void> {
  const root = await navigator.storage.getDirectory()
  const directory = await root.getDirectoryHandle('piper', { create: true })
  const handle = await directory.getFileHandle(filename, { create: true })
  const writable = await handle.createWritable()
  await writable.write(blob)
  await writable.close()
}

async function downloadModel(
  requestId: number,
  voiceId: PiperVoiceId,
  allowDownload: boolean
): Promise<void> {
  const voice = voices[voiceId]
  const { modelFile, configFile, modelUrl, configUrl } = modelFiles(voiceId)
  const installedModel = await cachedFile(modelFile)
  if (installedModel?.size === voice.size) {
    const digest = await crypto.subtle.digest('SHA-256', await installedModel.arrayBuffer())
    const actualHash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('')
    const installedConfig = await cachedFile(configFile)
    if (actualHash === voice.sha256 && installedConfig) {
      const normalizedConfig = parseModelConfig(await installedConfig.text())
      await cacheFile(
        configFile,
        new Blob([JSON.stringify(normalizedConfig)], { type: 'application/json' })
      )
      return
    }
  }

  if (!allowDownload) {
    throw new Error('Esta voz ainda não foi baixada. Use Ouvir prévia para instalar o modelo.')
  }

  const response = await fetch(modelUrl)
  if (!response.ok || !response.body) {
    throw new Error(`Falha ao baixar a voz (${response.status}).`)
  }

  const reader = response.body.getReader()
  const chunks: ArrayBuffer[] = []
  let loaded = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    loaded += value.byteLength
    if (loaded > voice.size) {
      await reader.cancel()
      throw new Error('O arquivo da voz excedeu o tamanho esperado.')
    }
    const chunk = new ArrayBuffer(value.byteLength)
    new Uint8Array(chunk).set(value)
    chunks.push(chunk)
    post({ type: 'progress', requestId, loaded, total: voice.size })
  }
  if (loaded !== voice.size) {
    throw new Error('O download da voz terminou incompleto.')
  }

  const modelBlob = new Blob(chunks)
  const digest = await crypto.subtle.digest('SHA-256', await modelBlob.arrayBuffer())
  const actualHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
  if (actualHash !== voice.sha256) {
    throw new Error('A verificação de integridade da voz falhou; o arquivo não foi instalado.')
  }

  const configResponse = await fetch(configUrl)
  if (!configResponse.ok) {
    throw new Error(`Falha ao baixar a configuração da voz (${configResponse.status}).`)
  }
  const configText = await configResponse.text()
  if (configText.length > 100_000) {
    throw new Error('A configuração da voz excedeu o tamanho esperado.')
  }
  const normalizedConfig = parseModelConfig(configText)

  await cacheFile(modelFile, modelBlob)
  await cacheFile(
    configFile,
    new Blob([JSON.stringify(normalizedConfig)], { type: 'application/json' })
  )
}

async function prepareVoice(
  requestId: number,
  voiceId: PiperVoiceId,
  allowDownload: boolean
): Promise<void> {
  if (activeVoiceId === voiceId && session) {
    post({ type: 'ready', requestId })
    return
  }
  if (activeVoiceId && activeVoiceId !== voiceId) {
    throw new Error('Reinicie o mecanismo local para trocar a voz.')
  }

  await downloadModel(requestId, voiceId, allowDownload)
  const modelFile = modelFiles(voiceId).modelFile
  PATH_MAP[voiceId] = `pt/pt_BR/${voices[voiceId].directory}/medium/${modelFile}`
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    configurable: true,
    value: 1
  })

  try {
    session = await TtsSession.create({
      voiceId,
      wasmPaths: {
        onnxWasm: new URL('.', new URL(onnxWasmUrl, self.location.href)).toString(),
        piperData: piperDataUrl,
        piperWasm: piperWasmUrl
      }
    })
  } catch (error) {
    TtsSession._instance = null
    session = null
    throw error
  }
  activeVoiceId = voiceId
  post({ type: 'ready', requestId })
}

async function handleRequest(request: VoiceWorkerRequest): Promise<void> {
  try {
    if (!isVoiceId(request.voiceId)) throw new Error('A voz Piper selecionada é inválida.')
    if (request.type === 'prepare') {
      await prepareVoice(request.requestId, request.voiceId, request.allowDownload)
      return
    }
    if (request.text.trim().length === 0 || request.text.length > 240) {
      throw new Error('O texto para síntese está vazio ou é longo demais.')
    }
    if (activeVoiceId !== request.voiceId || !session) {
      throw new Error('A voz Piper ainda não está pronta. Use Ouvir prévia primeiro.')
    }
    post({
      type: 'audio',
      requestId: request.requestId,
      blob: await session.predict(request.text)
    })
  } catch (error) {
    post({
      type: 'error',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : 'Falha inesperada na síntese local.'
    })
  }
}

self.addEventListener('message', (event: MessageEvent<VoiceWorkerRequest>) => {
  queuedWork = queuedWork.then(() => handleRequest(event.data))
})

export {}
