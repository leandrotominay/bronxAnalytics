import type {
  RiotPlatform,
  RiotSyncMatch,
  RiotSyncRequest,
  RiotSyncResponse
} from '../../../src/shared/riot-sync'
import { isRiotPlatform } from '../../../src/shared/riot-sync'

interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

interface CloudflareCacheStorage extends CacheStorage {
  default: Cache
}

interface WorkerEnvironment {
  RIOT_API_KEY?: string
  SYNC_RATE_LIMIT: RateLimitBinding
}

interface RankedMatchPage {
  matches: RiotSyncMatch[]
  nextStart: number | null
}

interface RiotRouting {
  regionalHost: string
  platformHost: string
}

interface RiotParticipant {
  puuid?: unknown
  win?: unknown
  championName?: unknown
  kills?: unknown
  deaths?: unknown
  assists?: unknown
  totalMinionsKilled?: unknown
  neutralMinionsKilled?: unknown
  goldEarned?: unknown
  totalDamageDealtToChampions?: unknown
}

interface RiotMatch {
  metadata?: { matchId?: unknown }
  info?: {
    queueId?: unknown
    gameStartTimestamp?: unknown
    gameDuration?: unknown
    participants?: unknown
  }
}

class RiotApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfter: string | null = null
  ) {
    super(message)
  }
}

const routeByPlatform: Record<RiotPlatform, RiotRouting> = {
  BR1: { regionalHost: 'americas', platformHost: 'br1' },
  NA1: { regionalHost: 'americas', platformHost: 'na1' },
  LA1: { regionalHost: 'americas', platformHost: 'la1' },
  LA2: { regionalHost: 'americas', platformHost: 'la2' },
  EUW1: { regionalHost: 'europe', platformHost: 'euw1' },
  EUN1: { regionalHost: 'europe', platformHost: 'eun1' },
  TR1: { regionalHost: 'europe', platformHost: 'tr1' },
  RU: { regionalHost: 'europe', platformHost: 'ru' },
  KR: { regionalHost: 'asia', platformHost: 'kr' },
  JP1: { regionalHost: 'asia', platformHost: 'jp1' },
  OC1: { regionalHost: 'sea', platformHost: 'oc1' },
  PH2: { regionalHost: 'sea', platformHost: 'ph2' },
  SG2: { regionalHost: 'sea', platformHost: 'sg2' },
  TH2: { regionalHost: 'sea', platformHost: 'th2' },
  TW2: { regionalHost: 'sea', platformHost: 'tw2' },
  VN2: { regionalHost: 'sea', platformHost: 'vn2' }
}

const maximumBodyLength = 12_000
const maximumMatchesPerSync = 20
const maximumMatchStart = 100_000
const successfulResponseCacheSeconds = 300
const edgeCache = (caches as CloudflareCacheStorage).default

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders
    }
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseSyncRequest(value: unknown): RiotSyncRequest | null {
  if (!isRecord(value)) return null
  const { gameName, tagLine, platform, start = 0 } = value
  if (
    typeof gameName !== 'string' ||
    gameName.trim().length === 0 ||
    gameName.length > 16 ||
    gameName.includes('#') ||
    typeof tagLine !== 'string' ||
    tagLine.trim().length === 0 ||
    tagLine.length > 8 ||
    tagLine.includes('#') ||
    !isRiotPlatform(platform) ||
    typeof start !== 'number' ||
    !Number.isInteger(start) ||
    start < 0 ||
    start > maximumMatchStart
  ) {
    return null
  }
  return {
    gameName: gameName.trim(),
    tagLine: tagLine.trim(),
    platform,
    start
  }
}

async function fetchRiotJson<T>(
  url: string,
  apiKey: string,
  api: 'Account-V1' | 'Match-V5' | 'League-V4'
): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'X-Riot-Token': apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000)
    })
  } catch (error) {
    throw new RiotApiError(
      error instanceof Error && error.name === 'TimeoutError'
        ? 'A API da Riot demorou para responder.'
        : 'Não foi possível conectar à API da Riot.',
      502
    )
  }

  if (!response.ok) {
    throw new RiotApiError(
      `A API ${api} da Riot recusou a solicitação (HTTP ${response.status}).`,
      response.status,
      response.headers.get('Retry-After')
    )
  }

  try {
    return (await response.json()) as T
  } catch (error) {
    throw new RiotApiError(
      error instanceof Error ? 'A API da Riot retornou uma resposta inválida.' : 'Resposta inválida.',
      502
    )
  }
}

async function getLeagueRank(
  routing: RiotRouting,
  puuid: string,
  apiKey: string
): Promise<RiotSyncResponse['rank']> {
  const url =
    `https://${routing.platformHost}.api.riotgames.com/lol/league/v4/entries/by-puuid/` +
    `${encodeURIComponent(puuid)}`
  let entries: unknown
  try {
    entries = await fetchRiotJson<unknown>(url, apiKey, 'League-V4')
  } catch (error) {
    if (error instanceof RiotApiError && error.status === 404) return null
    throw error
  }
  if (!Array.isArray(entries)) throw new RiotApiError('Resposta de elo inválida da Riot.', 502)
  const soloQueue = entries.find(
    (entry) => isRecord(entry) && entry.queueType === 'RANKED_SOLO_5x5'
  )
  if (!isRecord(soloQueue)) return null
  const leaguePoints =
    typeof soloQueue.leaguePoints === 'number' ? soloQueue.leaguePoints : 0
  if (
    typeof soloQueue.tier !== 'string' ||
    typeof soloQueue.rank !== 'string' ||
    !Number.isInteger(leaguePoints)
  ) {
    throw new RiotApiError('Dados de elo incompletos na resposta da Riot.', 502)
  }
  return {
    tier: soloQueue.tier,
    division: soloQueue.rank,
    leaguePoints
  }
}

async function getRankedMatches(
  regionalHost: string,
  puuid: string,
  apiKey: string,
  start: number
): Promise<RankedMatchPage> {
  const idsUrl =
    `https://${regionalHost}.api.riotgames.com/lol/match/v5/matches/by-puuid/` +
    `${encodeURIComponent(puuid)}/ids?queue=420&start=${start}&count=${maximumMatchesPerSync}`
  const ids = await fetchRiotJson<unknown>(idsUrl, apiKey, 'Match-V5')
  if (
    !Array.isArray(ids) ||
    ids.length > maximumMatchesPerSync ||
    ids.some((id) => typeof id !== 'string' || id.length > 64)
  ) {
    throw new RiotApiError('A lista de partidas retornada pela Riot é inválida.', 502)
  }

  const newIds = ids as string[]
  const matches: RiotSyncMatch[] = []
  for (let index = 0; index < newIds.length; index += 5) {
    const batch = newIds.slice(index, index + 5)
    const batchMatches = await Promise.all(
      batch.map(async (matchId) => {
        const matchUrl =
          `https://${regionalHost}.api.riotgames.com/lol/match/v5/matches/` +
          encodeURIComponent(matchId)
        const match = await fetchRiotJson<RiotMatch>(matchUrl, apiKey, 'Match-V5')
        const info = match.info
        if (
          !info ||
          match.metadata?.matchId !== matchId ||
          info.queueId !== 420 ||
          typeof info.gameStartTimestamp !== 'number' ||
          !Number.isFinite(info.gameStartTimestamp) ||
          !Number.isFinite(new Date(info.gameStartTimestamp).getTime()) ||
          typeof info.gameDuration !== 'number' ||
          info.gameDuration < 0 ||
          info.gameDuration > 24 * 60 * 60 ||
          !Array.isArray(info.participants)
        ) {
          throw new RiotApiError('Os dados de uma partida retornada pela Riot são inválidos.', 502)
        }
        const participant = info.participants.find(
          (entry): entry is RiotParticipant =>
            isRecord(entry) && entry.puuid === puuid && typeof entry.puuid === 'string'
        )
        if (
          !participant ||
          typeof participant.win !== 'boolean' ||
          typeof participant.championName !== 'string' ||
          !Number.isInteger(participant.kills) ||
          (participant.kills as number) < 0 ||
          !Number.isInteger(participant.deaths) ||
          (participant.deaths as number) < 0 ||
          !Number.isInteger(participant.assists) ||
          (participant.assists as number) < 0 ||
          !Number.isInteger(participant.totalMinionsKilled) ||
          (participant.totalMinionsKilled as number) < 0 ||
          !Number.isInteger(participant.neutralMinionsKilled) ||
          (participant.neutralMinionsKilled as number) < 0 ||
          !Number.isInteger(participant.goldEarned) ||
          (participant.goldEarned as number) < 0 ||
          !Number.isInteger(participant.totalDamageDealtToChampions) ||
          (participant.totalDamageDealtToChampions as number) < 0
        ) {
          throw new RiotApiError('Dados do jogador ausentes na partida retornada pela Riot.', 502)
        }
        return {
          matchId,
          startedAt: info.gameStartTimestamp,
          result: participant.win ? ('win' as const) : ('loss' as const),
          champion: participant.championName,
          durationSeconds: Math.max(0, Math.round(info.gameDuration)),
          stats: {
            kills: participant.kills as number,
            deaths: participant.deaths as number,
            assists: participant.assists as number,
            cs:
              (participant.totalMinionsKilled as number) +
              (participant.neutralMinionsKilled as number),
            goldEarned: participant.goldEarned as number,
            damageToChampions: participant.totalDamageDealtToChampions as number
          }
        }
      })
    )
    matches.push(...batchMatches)
  }
  return {
    matches,
    nextStart:
      newIds.length === maximumMatchesPerSync && start < maximumMatchStart
        ? Math.min(start + newIds.length, maximumMatchStart)
        : null
  }
}

async function syncRankedMatches(
  request: RiotSyncRequest,
  environment: WorkerEnvironment
): Promise<RiotSyncResponse> {
  const apiKey = environment.RIOT_API_KEY
  if (!apiKey) throw new RiotApiError('O backend ainda não configurou a chave Riot.', 503)
  const routing = routeByPlatform[request.platform]
  const accountUrl =
    `https://${routing.regionalHost}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/` +
    `${encodeURIComponent(request.gameName)}/${encodeURIComponent(request.tagLine)}`
  let account: unknown
  try {
    account = await fetchRiotJson<unknown>(accountUrl, apiKey, 'Account-V1')
  } catch (error) {
    if (error instanceof RiotApiError && error.status === 404) {
      throw new RiotApiError('Riot ID não encontrada nessa região.', 404)
    }
    throw error
  }
  if (!isRecord(account) || typeof account.puuid !== 'string' || !account.puuid) {
    throw new RiotApiError('A Riot ID não foi encontrada ou a resposta da Riot é inválida.', 404)
  }
  const [matchPage, rank] = await Promise.all([
    getRankedMatches(
      routing.      regionalHost,
      account.puuid,
      apiKey,
      request.start ?? 0
    ),
    getLeagueRank(routing, account.puuid, apiKey)
  ])
  return {
    matches: matchPage.matches,
    nextStart: matchPage.nextStart,
    rank,
    rankObservedAt: Date.now()
  }
}

async function handleRequest(request: Request, environment: WorkerEnvironment): Promise<Response> {
  const url = new URL(request.url)
  if (request.method === 'OPTIONS') return jsonResponse({}, 204)
  if (url.pathname === '/health' && request.method === 'GET') {
    return jsonResponse({ status: 'ok' })
  }
  if (url.pathname !== '/api/v1/sync' || request.method !== 'POST') {
    return jsonResponse({ error: 'Endpoint não encontrado.' }, 404)
  }

  const address = request.headers.get('CF-Connecting-IP') ?? 'local-development'
  const limit = await environment.SYNC_RATE_LIMIT.limit({ key: address })
  if (!limit.success) {
    return jsonResponse({ error: 'Muitas sincronizações. Tente novamente em um minuto.' }, 429, {
      'Retry-After': '60'
    })
  }

  const contentLength = Number(request.headers.get('Content-Length') ?? 0)
  if (contentLength > maximumBodyLength) {
    return jsonResponse({ error: 'A solicitação excede o tamanho permitido.' }, 413)
  }

  let body: unknown
  try {
    const text = await request.text()
    if (text.length > maximumBodyLength) {
      return jsonResponse({ error: 'A solicitação excede o tamanho permitido.' }, 413)
    }
    body = JSON.parse(text) as unknown
  } catch {
    return jsonResponse({ error: 'O corpo da solicitação deve ser JSON válido.' }, 400)
  }

  const syncRequest = parseSyncRequest(body)
  if (!syncRequest) {
    return jsonResponse({ error: 'Riot ID ou região inválida.' }, 400)
  }
  if (!environment.RIOT_API_KEY) {
    return jsonResponse({ error: 'O backend ainda não configurou a chave Riot.' }, 503)
  }

  try {
    const cacheKeyUrl = new URL('/_internal/cache/v1/sync', url.origin)
    cacheKeyUrl.searchParams.set('platform', syncRequest.platform)
    cacheKeyUrl.searchParams.set('gameName', syncRequest.gameName)
    cacheKeyUrl.searchParams.set('tagLine', syncRequest.tagLine)
    cacheKeyUrl.searchParams.set('start', String(syncRequest.start ?? 0))
    const cacheKey = new Request(cacheKeyUrl)
    const cached = await edgeCache.match(cacheKey)
    if (cached) return cached
    const response = await syncRankedMatches(syncRequest, environment)
    const cacheableResponse = jsonResponse(response, 200, {
      'Cache-Control': `public, max-age=${successfulResponseCacheSeconds}`
    })
    await edgeCache.put(cacheKey, cacheableResponse.clone())
    return cacheableResponse
  } catch (error) {
    if (!(error instanceof RiotApiError)) {
      console.error('Unexpected error while syncing Riot ranked matches.', error)
      return jsonResponse({ error: 'Erro inesperado ao sincronizar partidas.' }, 500)
    }
    const retryDelaySeconds =
      error.status === 429 && error.retryAfter && /^\d+$/.test(error.retryAfter)
        ? Number(error.retryAfter)
        : null
    const message =
      error.status === 429
        ? retryDelaySeconds !== null
          ? `A Riot limitou temporariamente as requisições. Aguarde ${retryDelaySeconds} segundos e tente novamente.`
          : 'A Riot limitou temporariamente as requisições. Aguarde alguns minutos e tente novamente.'
        : error.message
    const status =
      error.status === 401 || error.status === 403
        ? 503
        : error.status === 404
          ? 404
          : error.status === 429
            ? 429
            : error.status >= 500
              ? error.status
              : 502
    const headers: Record<string, string> = {}
    if (error.retryAfter) headers['Retry-After'] = error.retryAfter
    return jsonResponse({ error: message }, status, headers)
  }
}

export default {
  fetch(request: Request, environment: WorkerEnvironment): Promise<Response> {
    return handleRequest(request, environment)
  }
}
