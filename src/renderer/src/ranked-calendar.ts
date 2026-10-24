import championCatalog from '../assets/champions.json'
import {
  isRiotPlatform,
  type RiotPlatform,
  type RiotSyncRequest,
  type RiotSyncResponse
} from '../../shared/riot-sync'

type MatchResult = 'win' | 'loss' | 'remake'
type CalendarPeriod = 'week' | 'month' | 'year'
const defaultPdlPerWin = 23
const defaultPdlPerLoss = 23

interface RankedMatch {
  id: string
  matchId: string | null
  source: 'manual' | 'riot'
  startedAt: number | null
  date: string
  result: MatchResult
  durationSeconds?: number
  stats?: {
    kills: number
    deaths: number
    assists: number
    cs: number
    goldEarned: number
    damageToChampions: number
  }
  pdlBefore: number | null
  pdlAfter: number | null
  legacyPdl: number | null
  champion: string
  rankBefore: string
  rankAfter: string
  notes: string
  createdAt: number
}

interface PlayerProfile {
  gameName: string
  tagLine: string
  platform: RiotPlatform
  rank: string
  pdl: number | null
  rankSnapshotAt: number | null
  matchHistoryOffset: number
  hasMoreMatchHistory: boolean
  connected?: boolean
  pdlPerWin?: number
  pdlPerLoss?: number
}

interface StoredCalendar {
  version: 3
  profile: PlayerProfile
  records: RankedMatch[]
}

interface LegacyRankedMatch {
  id: string
  date: string
  result: MatchResult
  pdl: number | null
  champion: string
  rank: string
  notes: string
  createdAt: number
}

interface LegacyRankedMatchV2 {
  id: string
  date: string
  result: MatchResult
  pdlBefore: number | null
  pdlAfter: number | null
  legacyPdl: number | null
  champion: string
  rankBefore: string
  rankAfter: string
  notes: string
  createdAt: number
}

const storageKey = 'bronx-ranked-calendar'
const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
const dayFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
})
const championImageUrls = import.meta.glob<string>('../assets/champions/*.png', {
  eager: true,
  import: 'default',
  query: '?url'
})
const champions = championCatalog.champions

function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

function isMatchResult(value: string): value is MatchResult {
  return value === 'win' || value === 'loss' || value === 'remake'
}

function isOptionalPdl(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100)
  )
}

function isOptionalEstimate(value: unknown): value is number | undefined {
  return (
    value === undefined ||
    (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100)
  )
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isMatchStats(value: unknown): value is NonNullable<RankedMatch['stats']> {
  if (typeof value !== 'object' || value === null) return false
  const stats = value as Record<string, unknown>
  return (
    isNonNegativeInteger(stats.kills) &&
    isNonNegativeInteger(stats.deaths) &&
    isNonNegativeInteger(stats.assists) &&
    isNonNegativeInteger(stats.cs) &&
    isNonNegativeInteger(stats.goldEarned) &&
    isNonNegativeInteger(stats.damageToChampions)
  )
}

function isRankedMatch(value: unknown): value is RankedMatch {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    record.id.length > 0 &&
    (record.source === 'manual' || record.source === 'riot') &&
    (record.source === 'manual'
      ? record.matchId === null && record.startedAt === null
      : typeof record.matchId === 'string' &&
        /^[A-Za-z0-9_-]{1,64}$/.test(record.matchId) &&
        typeof record.startedAt === 'number' &&
        Number.isFinite(record.startedAt) &&
        Number.isFinite(new Date(record.startedAt).getTime())) &&
    isDateKey(record.date) &&
    (record.result === 'win' || record.result === 'loss' || record.result === 'remake') &&
    (record.durationSeconds === undefined ||
      (typeof record.durationSeconds === 'number' &&
        Number.isInteger(record.durationSeconds) &&
        record.durationSeconds >= 0 &&
        record.durationSeconds <= 24 * 60 * 60)) &&
    (record.stats === undefined || isMatchStats(record.stats)) &&
    isOptionalPdl(record.pdlBefore) &&
    isOptionalPdl(record.pdlAfter) &&
    (record.legacyPdl === null ||
      (typeof record.legacyPdl === 'number' &&
        Number.isInteger(record.legacyPdl) &&
        record.legacyPdl >= -100 &&
        record.legacyPdl <= 100)) &&
    typeof record.champion === 'string' &&
    record.champion.length <= 40 &&
    typeof record.rankBefore === 'string' &&
    record.rankBefore.length <= 40 &&
    typeof record.rankAfter === 'string' &&
    record.rankAfter.length <= 40 &&
    typeof record.notes === 'string' &&
    record.notes.length <= 180 &&
    typeof record.createdAt === 'number' &&
    Number.isFinite(record.createdAt)
  )
}

function isPlayerProfile(value: unknown): value is PlayerProfile {
  if (!value || typeof value !== 'object') return false
  const profile = value as Record<string, unknown>
  return (
    typeof profile.gameName === 'string' &&
    profile.gameName.length <= 16 &&
    typeof profile.tagLine === 'string' &&
    profile.tagLine.length <= 8 &&
    isRiotPlatform(profile.platform) &&
    typeof profile.rank === 'string' &&
    profile.rank.length <= 40 &&
    (profile.matchHistoryOffset === undefined ||
      (typeof profile.matchHistoryOffset === 'number' &&
        Number.isSafeInteger(profile.matchHistoryOffset) &&
        profile.matchHistoryOffset >= 0 &&
        profile.matchHistoryOffset <= 100_000)) &&
    (profile.hasMoreMatchHistory === undefined ||
      typeof profile.hasMoreMatchHistory === 'boolean') &&
    (profile.connected === undefined || typeof profile.connected === 'boolean') &&
    isOptionalEstimate(profile.pdlPerWin) &&
    isOptionalEstimate(profile.pdlPerLoss) &&
    isOptionalPdl(profile.pdl) &&
    (profile.rankSnapshotAt === null ||
      (typeof profile.rankSnapshotAt === 'number' && Number.isFinite(profile.rankSnapshotAt)))
  )
}

function isStoredCalendar(value: unknown): value is StoredCalendar {
  if (!value || typeof value !== 'object') return false
  const stored = value as Record<string, unknown>
  return (
    stored.version === 3 &&
    isPlayerProfile(stored.profile) &&
    Array.isArray(stored.records) &&
    stored.records.every(isRankedMatch)
  )
}

function isLegacyRecord(value: unknown): value is LegacyRankedMatch {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    record.id.length > 0 &&
    isDateKey(record.date) &&
    (record.result === 'win' || record.result === 'loss' || record.result === 'remake') &&
    (record.pdl === null ||
      (typeof record.pdl === 'number' &&
        Number.isInteger(record.pdl) &&
        record.pdl >= -100 &&
        record.pdl <= 100)) &&
    typeof record.champion === 'string' &&
    record.champion.length <= 40 &&
    typeof record.rank === 'string' &&
    record.rank.length <= 40 &&
    typeof record.notes === 'string' &&
    record.notes.length <= 180 &&
    typeof record.createdAt === 'number' &&
    Number.isFinite(record.createdAt)
  )
}

function isLegacyCalendar(value: unknown): value is { version: 1; records: LegacyRankedMatch[] } {
  if (!value || typeof value !== 'object') return false
  const stored = value as Record<string, unknown>
  return stored.version === 1 && Array.isArray(stored.records) && stored.records.every(isLegacyRecord)
}

function isLegacyRankedMatchV2(value: unknown): value is LegacyRankedMatchV2 {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    record.id.length > 0 &&
    isDateKey(record.date) &&
    (record.result === 'win' || record.result === 'loss' || record.result === 'remake') &&
    isOptionalPdl(record.pdlBefore) &&
    isOptionalPdl(record.pdlAfter) &&
    (record.legacyPdl === null ||
      (typeof record.legacyPdl === 'number' &&
        Number.isInteger(record.legacyPdl) &&
        record.legacyPdl >= -100 &&
        record.legacyPdl <= 100)) &&
    typeof record.champion === 'string' &&
    record.champion.length <= 40 &&
    typeof record.rankBefore === 'string' &&
    record.rankBefore.length <= 40 &&
    typeof record.rankAfter === 'string' &&
    record.rankAfter.length <= 40 &&
    typeof record.notes === 'string' &&
    record.notes.length <= 180 &&
    typeof record.createdAt === 'number' &&
    Number.isFinite(record.createdAt)
  )
}

function isVersion2Calendar(
  value: unknown
): value is {
  version: 2
  profile: { gameName: string; tagLine: string; rank: string; pdl: number | null }
  records: LegacyRankedMatchV2[]
} {
  if (!value || typeof value !== 'object') return false
  const stored = value as Record<string, unknown>
  const profile = stored.profile
  if (!profile || typeof profile !== 'object') return false
  const candidate = profile as Record<string, unknown>
  return (
    stored.version === 2 &&
    typeof candidate.gameName === 'string' &&
    candidate.gameName.length <= 16 &&
    typeof candidate.tagLine === 'string' &&
    candidate.tagLine.length <= 8 &&
    typeof candidate.rank === 'string' &&
    candidate.rank.length <= 40 &&
    isOptionalPdl(candidate.pdl) &&
    Array.isArray(stored.records) &&
    stored.records.every(isLegacyRankedMatchV2)
  )
}

function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatPdl(value: number | null): string {
  if (value === null || value === 0) return value === 0 ? '0 PDL' : '—'
  return `${value > 0 ? '+' : ''}${value} PDL`
}

function getMatchPdl(record: RankedMatch): number | null {
  if (record.pdlBefore !== null && record.pdlAfter !== null) {
    const rankBefore = record.rankBefore.trim().toLocaleLowerCase('pt-BR')
    const rankAfter = record.rankAfter.trim().toLocaleLowerCase('pt-BR')
    if (!rankBefore || rankBefore !== rankAfter) {
      return null
    }

    return record.pdlAfter - record.pdlBefore
  }
  if (record.pdlBefore !== null || record.pdlAfter !== null) return null
  return record.legacyPdl
}

function estimatePdl(
  recordSet: RankedMatch[],
  pdlPerWin: number,
  pdlPerLoss: number
): number | null {
  const wins = recordSet.filter((record) => record.result === 'win').length
  const losses = recordSet.filter((record) => record.result === 'loss').length
  return wins + losses === 0 ? null : wins * pdlPerWin - losses * pdlPerLoss
}

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}min ${String(seconds % 60).padStart(2, '0')}s`
}

function formatKda(stats: NonNullable<RankedMatch['stats']>): string {
  const ratio =
    stats.deaths === 0
      ? stats.kills + stats.assists
      : (stats.kills + stats.assists) / stats.deaths
  return `${stats.kills}/${stats.deaths}/${stats.assists} · ${ratio.toFixed(2)} KDA`
}

function getChampion(value: string): (typeof champions)[number] | undefined {
  const normalized = value.trim().toLocaleLowerCase('pt-BR')
  return champions.find(
    (champion) =>
      champion.id.toLocaleLowerCase('pt-BR') === normalized ||
      champion.name.toLocaleLowerCase('pt-BR') === normalized
  )
}

function getChampionImage(championId: string): string | undefined {
  return championImageUrls[`../assets/champions/${championId}.png`]
}

function formatRiotRank(tier: string, division: string): string {
  const localizedTiers: Record<string, string> = {
    IRON: 'Ferro',
    BRONZE: 'Bronze',
    SILVER: 'Prata',
    GOLD: 'Ouro',
    PLATINUM: 'Platina',
    EMERALD: 'Esmeralda',
    DIAMOND: 'Diamante',
    MASTER: 'Mestre',
    GRANDMASTER: 'Grão-Mestre',
    CHALLENGER: 'Desafiante'
  }
  return `${localizedTiers[tier] ?? tier} ${division}`.trim()
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName)
  element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Required ranked calendar element was not found: ${selector}`)
  return element
}

export function initializeRankedCalendar(): void {
  const pageTitle = requireElement<HTMLElement>('#page-title')
  const yasuoHeroArtwork = requireElement<HTMLImageElement>('#yasuo-hero-artwork')
  const homePage = requireElement<HTMLElement>('#home-page')
  const matchPage = requireElement<HTMLElement>('#match-page')
  const flashPage = requireElement<HTMLElement>('#flash-page')
  const calendarPage = requireElement<HTMLElement>('#calendar-page')
  const voicePage = requireElement<HTMLElement>('#voice-page')
  const navigation = requireElement<HTMLElement>('.sidebar-navigation')
  const status = requireElement<HTMLElement>('#calendar-status')
  const previousMonth = requireElement<HTMLButtonElement>('#calendar-previous-month')
  const nextMonth = requireElement<HTMLButtonElement>('#calendar-next-month')
  const todayButton = requireElement<HTMLButtonElement>('#calendar-today')
  const monthTitle = requireElement<HTMLElement>('#calendar-month-title')
  const days = requireElement<HTMLElement>('#calendar-days')
  const weekdays = requireElement<HTMLElement>('.calendar-weekdays')
  const totalGames = requireElement<HTMLElement>('#calendar-total-games')
  const totalWins = requireElement<HTMLElement>('#calendar-total-wins')
  const totalLosses = requireElement<HTMLElement>('#calendar-total-losses')
  const totalPdl = requireElement<HTMLElement>('#calendar-total-pdl')
  const totalPdlLabel = requireElement<HTMLElement>('#calendar-total-pdl-label')
  const dayPdlLabel = requireElement<HTMLElement>('#calendar-day-pdl-label')
  const pdlSettingsForm = requireElement<HTMLFormElement>('#calendar-pdl-settings')
  const pdlWinInput = requireElement<HTMLInputElement>('#calendar-pdl-win')
  const pdlLossInput = requireElement<HTMLInputElement>('#calendar-pdl-loss')
  const accountNameInput = requireElement<HTMLInputElement>('#calendar-riot-name')
  const accountTagInput = requireElement<HTMLInputElement>('#calendar-riot-tag')
  const accountPlatformInput = requireElement<HTMLSelectElement>('#calendar-profile-platform')
  const accountForm = requireElement<HTMLFormElement>('#calendar-profile-form')
  const connectedAccount = requireElement<HTMLElement>('#calendar-connected-account')
  const connectedName = requireElement<HTMLElement>('#calendar-connected-name')
  const disconnectButton = requireElement<HTMLButtonElement>('#calendar-disconnect')
  const syncButton = requireElement<HTMLButtonElement>('#calendar-sync-matches')
  const periodFilter = requireElement<HTMLSelectElement>('#calendar-period')
  const profileRiotId = requireElement<HTMLElement>('#calendar-profile-riot-id')
  const profileRank = requireElement<HTMLElement>('#calendar-profile-rank-value')
  const matchPageRiotId = requireElement<HTMLElement>('#match-profile-riot-id')
  const matchPageRank = requireElement<HTMLElement>('#match-profile-rank-value')
  const syncWarning = requireElement<HTMLElement>('#calendar-sync-warning')
  const selectedDayTitle = requireElement<HTMLElement>('#calendar-selected-day')
  const dayPdl = requireElement<HTMLElement>('#calendar-day-pdl')
  const matchList = requireElement<HTMLElement>('#calendar-match-list')
  const selectedDayDetails = requireElement<HTMLDetailsElement>('#calendar-day-details')
  const loadOlderMatchesButton =
    requireElement<HTMLButtonElement>('#calendar-load-older-matches')
  const dialog = requireElement<HTMLDialogElement>('#ranked-match-dialog')
  const form = requireElement<HTMLFormElement>('#ranked-match-form')
  const formTitle = requireElement<HTMLElement>('#ranked-match-dialog-title')
  const recordId = requireElement<HTMLInputElement>('#ranked-match-id')
  const dateInput = requireElement<HTMLInputElement>('#ranked-match-date')
  const resultInput = requireElement<HTMLSelectElement>('#ranked-match-result')
  const pdlBeforeInput = requireElement<HTMLInputElement>('#ranked-match-pdl-before')
  const pdlAfterInput = requireElement<HTMLInputElement>('#ranked-match-pdl-after')
  const championInput = requireElement<HTMLSelectElement>('#ranked-match-champion')
  const rankBeforeInput = requireElement<HTMLInputElement>('#ranked-match-rank-before')
  const rankAfterInput = requireElement<HTMLInputElement>('#ranked-match-rank-after')
  const notesInput = requireElement<HTMLTextAreaElement>('#ranked-match-notes')
  const saveButton = requireElement<HTMLButtonElement>('#ranked-match-save')
  const closeButton = requireElement<HTMLButtonElement>('#ranked-match-close')
  const cancelButton = requireElement<HTMLButtonElement>('#ranked-match-cancel')

  let records: RankedMatch[] = []
  let profile: PlayerProfile = {
    gameName: '',
    tagLine: '',
    platform: 'BR1',
    rank: '',
    pdl: null,
    rankSnapshotAt: null,
    matchHistoryOffset: 0,
    hasMoreMatchHistory: false,
    pdlPerWin: defaultPdlPerWin,
    pdlPerLoss: defaultPdlPerLoss
  }
  let storageReady = true
  let syncInProgress = false
  let syncInterval: number | null = null
  let selectedDate = dateKey(new Date())
  let visibleMonth = new Date()
  visibleMonth.setDate(1)
  let calendarPeriod: CalendarPeriod = 'month'
  pdlWinInput.value = String(defaultPdlPerWin)
  pdlLossInput.value = String(defaultPdlPerLoss)
  yasuoHeroArtwork.addEventListener('error', () => {
    if (yasuoHeroArtwork.dataset.fallbackApplied === 'true') return
    yasuoHeroArtwork.dataset.fallbackApplied = 'true'
    yasuoHeroArtwork.src = './assets/champions/Yasuo.png'
  })

  function reportStatus(message: string, isError = false): void {
    status.textContent = message
    status.dataset.error = String(isError)
  }

  function getFriendlySyncError(error: unknown): string {
    const message = error instanceof Error ? error.message.toLocaleLowerCase('pt-BR') : ''
    if (message.includes('429') || message.includes('limitou temporariamente')) {
      return 'A Riot está recebendo muitas consultas. Aguarde alguns minutos e tente novamente.'
    }
    if (message.includes('riot id não encontrada')) {
      return 'Não foi possível encontrar esse Riot ID no servidor escolhido. Confira o nome, a tag e a região.'
    }
    if (message.includes('401') || message.includes('403') || message.includes('chave riot')) {
      return 'O serviço de partidas está temporariamente indisponível. Tente novamente mais tarde.'
    }
    if (message.includes('timeout') || message.includes('tempo limite')) {
      return 'A sincronização demorou mais que o esperado. Tente novamente em instantes.'
    }
    return 'Não foi possível sincronizar as partidas agora. Confira sua conexão e tente novamente.'
  }

  function loadRecords(): void {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored === null) return
      const parsed: unknown = JSON.parse(stored)
      let loaded: RankedMatch[]
      if (isStoredCalendar(parsed)) {
        loaded = parsed.records
        const importedMatchCount = loaded.filter((record) => record.source === 'riot').length
        profile = {
          gameName: parsed.profile.gameName,
          tagLine: parsed.profile.tagLine,
          platform: parsed.profile.platform,
          rank: parsed.profile.rank,
          pdl: parsed.profile.pdl,
          rankSnapshotAt: parsed.profile.rankSnapshotAt,
          matchHistoryOffset:
            parsed.profile.matchHistoryOffset ?? Math.min(importedMatchCount, 20),
          hasMoreMatchHistory:
            parsed.profile.hasMoreMatchHistory ?? importedMatchCount >= 15,
          connected: parsed.profile.connected ?? false,
          pdlPerWin: parsed.profile.pdlPerWin ?? defaultPdlPerWin,
          pdlPerLoss: parsed.profile.pdlPerLoss ?? defaultPdlPerLoss
        }
      } else if (isVersion2Calendar(parsed)) {
        loaded = parsed.records.map((record) => ({
          ...record,
          matchId: null,
          source: 'manual',
          startedAt: null
        }))
        profile = {
          ...parsed.profile,
          platform: 'BR1',
          rankSnapshotAt: null,
          matchHistoryOffset: 0,
          hasMoreMatchHistory: false
        }
      } else if (isLegacyCalendar(parsed)) {
        loaded = parsed.records.map((record) => ({
          id: record.id,
          matchId: null,
          source: 'manual',
          startedAt: null,
          date: record.date,
          result: record.result,
          pdlBefore: null,
          pdlAfter: null,
          legacyPdl: record.pdl,
          champion: record.champion,
          rankBefore: '',
          rankAfter: record.rank,
          notes: record.notes,
          createdAt: record.createdAt
        }))
      } else {
        throw new Error('O formato dos registros locais não é reconhecido.')
      }
      if (new Set(loaded.map((record) => record.id)).size !== loaded.length) {
        throw new Error('Há registros duplicados no armazenamento local.')
      }
      const storedMatchIds = loaded
        .map((record) => record.matchId)
        .filter((matchId): matchId is string => matchId !== null)
      if (new Set(storedMatchIds).size !== storedMatchIds.length) {
        throw new Error('Há partidas da Riot duplicadas no armazenamento local.')
      }
      records = loaded
      accountNameInput.value = profile.gameName
      accountTagInput.value = profile.tagLine
      accountPlatformInput.value = profile.platform
      pdlWinInput.value = String(profile.pdlPerWin ?? defaultPdlPerWin)
      pdlLossInput.value = String(profile.pdlPerLoss ?? defaultPdlPerLoss)
      renderProfile()
    } catch {
      storageReady = false
      reportStatus(
        'Não foi possível carregar o histórico salvo neste dispositivo. Seus dados não foram alterados.',
        true
      )
    }
  }

  function saveRecords(updated: RankedMatch[], updatedProfile = profile): boolean {
    if (!storageReady) {
      reportStatus('O armazenamento local não está disponível para gravação segura.', true)
      return false
    }
    try {
      const data: StoredCalendar = { version: 3, profile: updatedProfile, records: updated }
      localStorage.setItem(storageKey, JSON.stringify(data))
      records = updated
      profile = updatedProfile
      reportStatus('Registro salvo somente neste dispositivo.')
      return true
    } catch {
      reportStatus('Não foi possível salvar as alterações neste dispositivo.', true)
      return false
    }
  }

  function renderProfile(): void {
    const isConnected = Boolean(profile.connected && profile.gameName && profile.tagLine)
    const riotId =
      profile.gameName && profile.tagLine
        ? `${profile.gameName}#${profile.tagLine}`
        : 'Riot ID não cadastrado'
    const currentRank = profile.rank
      ? `${profile.rank}${profile.pdl === null ? '' : ` · ${profile.pdl} PDL`}`
      : 'Elo não informado'
    profileRiotId.textContent = riotId
    profileRank.textContent = currentRank
    matchPageRiotId.textContent = riotId
    matchPageRank.textContent = currentRank
    accountForm.hidden = isConnected
    connectedAccount.hidden = !isConnected
    connectedName.textContent = isConnected ? riotId : ''
    syncWarning.hidden = isConnected
  }

  async function synchronizeRankedMatches(loadOlderPage = false): Promise<void> {
    if (syncInProgress) return
    if (!storageReady) {
      reportStatus('O armazenamento local não está disponível para sincronizar com segurança.', true)
      return
    }
    if (!profile.gameName || !profile.tagLine) {
      reportStatus('Preencha o Riot ID para sincronizar as partidas.', true)
      return
    }

    syncInProgress = true
    syncButton.disabled = true
    syncButton.textContent = 'Sincronizando…'
    loadOlderMatchesButton.disabled = true
    reportStatus(
      loadOlderPage
        ? 'Buscando partidas mais antigas na API oficial da Riot.'
        : 'Buscando as partidas ranqueadas mais recentes na API oficial da Riot.'
    )
    try {
      const request: RiotSyncRequest = {
        gameName: profile.gameName,
        tagLine: profile.tagLine,
        platform: profile.platform,
        start: loadOlderPage ? profile.matchHistoryOffset : 0
      }
      if (!window.companion?.syncRiotRankedMatches) {
        throw new Error('A sincronização de partidas só está disponível no aplicativo desktop.')
      }
      const result: RiotSyncResponse =
        await window.companion.syncRiotRankedMatches(request)
      const existingIds = new Set(
        records.map((record) => record.matchId).filter((id): id is string => id !== null)
      )
      const refreshedMatches = new Map(
        result.matches.map((match) => [match.matchId, match] as const)
      )
      const recordsWithRefreshedStats = records.map((record) => {
        if (record.source !== 'riot' || !record.matchId) return record
        const refreshed = refreshedMatches.get(record.matchId)
        if (!refreshed || (record.stats && record.durationSeconds !== undefined)) return record
        return {
          ...record,
          stats: refreshed.stats,
          durationSeconds: refreshed.durationSeconds
        }
      })
      const imported = result.matches
        .filter((match) => !existingIds.has(match.matchId))
        .map((match): RankedMatch => ({
          id: `riot-${match.matchId}`,
          matchId: match.matchId,
          source: 'riot',
          startedAt: match.startedAt,
          date: dateKey(new Date(match.startedAt)),
          result: match.result,
          durationSeconds: match.durationSeconds,
          stats: match.stats,
          pdlBefore: null,
          pdlAfter: null,
          legacyPdl: null,
          champion: match.champion,
          rankBefore: '',
          rankAfter: '',
          notes: '',
          createdAt: match.startedAt
        }))
      const currentRank = result.rank
        ? formatRiotRank(result.rank.tier, result.rank.division)
        : 'Sem ranque solo'
      const shouldUseRankSnapshot =
        profile.rankSnapshotAt === null || result.rankObservedAt >= profile.rankSnapshotAt
      const updatedProfile: PlayerProfile = {
        ...profile,
        rank: shouldUseRankSnapshot ? currentRank : profile.rank,
        pdl: shouldUseRankSnapshot ? (result.rank?.leaguePoints ?? null) : profile.pdl,
        rankSnapshotAt: shouldUseRankSnapshot ? result.rankObservedAt : profile.rankSnapshotAt,
        connected: true,
        matchHistoryOffset: loadOlderPage
          ? (result.nextStart ?? profile.matchHistoryOffset)
          : profile.matchHistoryOffset === 0
            ? (result.nextStart ?? 0)
            : profile.matchHistoryOffset,
        hasMoreMatchHistory: loadOlderPage
          ? result.nextStart !== null
          : profile.hasMoreMatchHistory || result.nextStart !== null
      }
      const lastObservedSnapshot = profile.rankSnapshotAt
      const importedRecord = imported[0]
      if (
        result.rank &&
        lastObservedSnapshot !== null &&
        result.rankObservedAt > lastObservedSnapshot &&
        profile.rank === currentRank &&
        profile.pdl !== null &&
        imported.length === 1 &&
        importedRecord
      ) {
        const importedMatch = result.matches.find(
          (match) => match.matchId === importedRecord.matchId
        )
        const matchFinishedAt = importedMatch
          ? importedMatch.startedAt + importedMatch.durationSeconds * 1000
          : Number.POSITIVE_INFINITY
        const snapshotAge = result.rankObservedAt - lastObservedSnapshot
        if (
          importedMatch &&
          lastObservedSnapshot <= matchFinishedAt &&
          result.rankObservedAt >= matchFinishedAt &&
          snapshotAge >= 0 &&
          snapshotAge <= 2 * 60 * 60 * 1000
        ) {
          importedRecord.pdlBefore = profile.pdl
          importedRecord.pdlAfter = result.rank.leaguePoints
          importedRecord.rankBefore = profile.rank
          importedRecord.rankAfter = currentRank
        }
      }
      if (!saveRecords([...recordsWithRefreshedStats, ...imported], updatedProfile)) return
      renderProfile()
      render()
      reportStatus(
        loadOlderPage
          ? imported.length > 0
            ? `${imported.length} partida(s) mais antiga(s) adicionada(s) ao histórico.`
            : 'Não há novas partidas nessa página do histórico.'
          : imported.length > 0
            ? `${imported.length} nova(s) partida(s) ranqueada(s) importada(s); próximas verificações em 15 minutos.`
            : 'Histórico atualizado; nenhuma partida ranqueada nova. Próxima verificação automática em 15 minutos.'
      )
    } catch (error) {
      reportStatus(getFriendlySyncError(error), true)
    } finally {
      syncInProgress = false
      syncButton.disabled = false
      syncButton.textContent = 'Sincronizar agora'
      loadOlderMatchesButton.hidden = !profile.hasMoreMatchHistory
      loadOlderMatchesButton.disabled = !profile.hasMoreMatchHistory
    }
  }

  function startAutomaticSync(): void {
    if (!profile.gameName || !profile.tagLine) return
    void synchronizeRankedMatches()
    if (syncInterval !== null) return
    syncInterval = window.setInterval(() => {
      void synchronizeRankedMatches()
    }, 15 * 60 * 1000)
  }

  function stopAutomaticSync(): void {
    if (syncInterval === null) return
    window.clearInterval(syncInterval)
    syncInterval = null
  }

  function recordsForDate(key: string): RankedMatch[] {
    return records
      .filter((record) => record.date === key)
      .sort((first, second) => first.createdAt - second.createdAt)
  }

  function renderDayDetails(): void {
    const dayRecords = recordsForDate(selectedDate)
    const dayTotal = estimatePdl(
      dayRecords,
      profile.pdlPerWin ?? defaultPdlPerWin,
      profile.pdlPerLoss ?? defaultPdlPerLoss
    )
    selectedDayTitle.textContent = dayFormatter.format(dateFromKey(selectedDate))
    dayPdl.textContent = dayTotal === null ? '—' : `${formatPdl(dayTotal)} estimado`
    dayPdl.className =
      dayTotal !== null && dayTotal > 0
        ? 'pdl-positive'
        : dayTotal !== null && dayTotal < 0
          ? 'pdl-negative'
          : ''
    dayPdl.title = `Estimativa: +${profile.pdlPerWin ?? defaultPdlPerWin} PDL por vitória e −${profile.pdlPerLoss ?? defaultPdlPerLoss} PDL por derrota.`
    dayPdlLabel.textContent =
      `PARTIDAS DO DIA · +${profile.pdlPerWin ?? defaultPdlPerWin} / −${profile.pdlPerLoss ?? defaultPdlPerLoss} PDL`
    matchList.replaceChildren()
    loadOlderMatchesButton.hidden = !profile.hasMoreMatchHistory
    loadOlderMatchesButton.disabled = syncInProgress

    if (dayRecords.length === 0) {
      matchList.append(createElement('li', 'calendar-empty-day', 'Nenhum registro para este dia.'))
      return
    }

    for (const record of dayRecords) {
      const item = createElement('li', 'calendar-match')
      item.dataset.result = record.result
      const main = createElement('div', 'calendar-match-main')
      const resultText =
        record.result === 'win' ? 'Vitória' : record.result === 'loss' ? 'Derrota' : 'Remake'
      main.append(
        createElement(
          'strong',
          `calendar-match-outcome result-${record.result}`,
          resultText
        )
      )
      const matchPdl = getMatchPdl(record)
      if (matchPdl !== null) {
        const pdlElement = createElement('strong', 'calendar-match-pdl', formatPdl(matchPdl))
        if (matchPdl > 0) pdlElement.classList.add('pdl-positive')
        else if (matchPdl < 0) pdlElement.classList.add('pdl-negative')
        main.append(pdlElement)
      }
      const details: string[] = []
      const champion = getChampion(record.champion)
      if (record.source === 'riot') details.push('Importada')
      if (record.startedAt !== null) {
        details.push(
          new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(
            record.startedAt
          )
        )
      }
      if (record.durationSeconds !== undefined) {
        details.push(formatDuration(record.durationSeconds))
      }
      if (record.rankAfter) details.push(`Elo: ${record.rankAfter}`)
      if (record.pdlBefore !== null && record.pdlAfter !== null && matchPdl === null) {
        details.push('PDL não comparável; informe o mesmo elo antes e depois')
      }
      if (details.length) main.append(createElement('span', '', details.join(' · ')))
      if (record.champion) {
        main.append(
          createElement('span', 'calendar-match-champion', champion?.name ?? record.champion)
        )
      }
      if (record.stats) {
        const statsBlock = createElement('div', 'calendar-match-stats')
        const score = createElement('strong', 'calendar-match-kda-score')
        score.append(
          createElement('span', '', String(record.stats.kills)),
          createElement('span', '', '/'),
          createElement('span', '', String(record.stats.deaths)),
          createElement('span', '', '/'),
          createElement('span', '', String(record.stats.assists))
        )
        const ratio = createElement('span', 'calendar-match-kda-ratio', formatKda(record.stats).split(' · ')[1])
        const kda = createElement('div', 'calendar-match-kda')
        kda.append(score, ratio)
        const statItems: Array<[string, string]> = [
          ['FARM', `${record.stats.cs} CS`],
          ['OURO', `${record.stats.goldEarned.toLocaleString('pt-BR')}`],
          ['DANO', `${record.stats.damageToChampions.toLocaleString('pt-BR')}`]
        ]
        const statGrid = createElement('div', 'calendar-match-stat-grid')
        for (const [label, value] of statItems) {
          const stat = createElement('div', 'calendar-match-stat')
          stat.append(createElement('span', '', label), createElement('strong', '', value))
          statGrid.append(stat)
        }
        statsBlock.append(kda, statGrid)
        main.append(statsBlock)
      }
      if (record.notes) main.append(createElement('p', '', record.notes))
      const championImage = champion ? getChampionImage(champion.id) : undefined
      if (championImage) {
        const portrait = createElement('img', 'calendar-match-portrait')
        portrait.src = championImage
        portrait.alt = ''
        portrait.setAttribute('aria-hidden', 'true')
        item.prepend(portrait)
        item.classList.add('has-champion')
      }

      const actions = createElement('div', 'calendar-match-actions')
      const editButton = createElement('button', '', 'Editar')
      editButton.type = 'button'
      editButton.addEventListener('click', () => openDialog(record))
      const deleteButton = createElement('button', '', 'Excluir')
      deleteButton.type = 'button'
      deleteButton.addEventListener('click', () => {
        if (!window.confirm('Excluir este registro local?')) return
        const remaining = records.filter((candidate) => candidate.id !== record.id)
        if (saveRecords(remaining)) render()
      })
      actions.append(editButton, deleteButton)
      item.append(main, actions)
      matchList.append(item)
    }
  }

  function render(): void {
    const year = visibleMonth.getFullYear()
    const month = visibleMonth.getMonth()
    const selectedDay = dateFromKey(selectedDate)
    let rangeStart: Date
    let rangeEnd: Date
    if (calendarPeriod === 'week') {
      rangeStart = new Date(selectedDay)
      rangeStart.setDate(rangeStart.getDate() - ((rangeStart.getDay() + 6) % 7))
      rangeEnd = new Date(rangeStart)
      rangeEnd.setDate(rangeEnd.getDate() + 7)
      const rangeEndLabel = new Date(rangeEnd)
      rangeEndLabel.setDate(rangeEndLabel.getDate() - 1)
      const rangeFormatter = new Intl.DateTimeFormat('pt-BR', {
        day: 'numeric',
        month: 'short'
      })
      monthTitle.textContent = `${rangeFormatter.format(rangeStart)} – ${rangeFormatter.format(rangeEndLabel)}`
    } else if (calendarPeriod === 'year') {
      rangeStart = new Date(year, 0, 1)
      rangeEnd = new Date(year + 1, 0, 1)
      monthTitle.textContent = String(year)
    } else {
      rangeStart = new Date(year, month, 1)
      rangeEnd = new Date(year, month + 1, 1)
      monthTitle.textContent = monthFormatter.format(visibleMonth)
    }
    const periodRecords = records.filter((record) => {
      const recordDate = dateFromKey(record.date)
      return recordDate >= rangeStart && recordDate < rangeEnd
    })
    const wins = periodRecords.filter((record) => record.result === 'win').length
    const losses = periodRecords.filter((record) => record.result === 'loss').length
    const pdlPerWin = profile.pdlPerWin ?? defaultPdlPerWin
    const pdlPerLoss = profile.pdlPerLoss ?? defaultPdlPerLoss
    const periodPdl = estimatePdl(periodRecords, pdlPerWin, pdlPerLoss)
    totalPdlLabel.textContent = `PDL estimado · +${pdlPerWin} / −${pdlPerLoss}`
    totalGames.textContent = String(periodRecords.length)
    totalWins.textContent = String(wins)
    totalLosses.textContent = String(losses)
    totalPdl.textContent = periodPdl === null ? '—' : formatPdl(periodPdl)
    totalPdl.className =
      periodPdl !== null && periodPdl > 0
        ? 'pdl-positive'
        : periodPdl !== null && periodPdl < 0
          ? 'pdl-negative'
          : ''

    const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7
    const gridStart =
      calendarPeriod === 'week'
        ? rangeStart
        : calendarPeriod === 'year'
          ? rangeStart
          : new Date(year, month, 1 - firstDayOffset)
    const today = dateKey(new Date())
    days.replaceChildren()
    days.classList.toggle('is-year-view', calendarPeriod === 'year')
    weekdays.hidden = calendarPeriod === 'year'
    const dayCount = calendarPeriod === 'week' ? 7 : calendarPeriod === 'year' ? 12 : 42
    for (let index = 0; index < dayCount; index += 1) {
      if (calendarPeriod === 'year') {
        const monthDate = new Date(year, index, 1)
        const monthRecords = records.filter((record) => {
          const recordDate = dateFromKey(record.date)
          return recordDate.getFullYear() === year && recordDate.getMonth() === index
        })
        const monthPdl = estimatePdl(monthRecords, pdlPerWin, pdlPerLoss)
        const monthButton = createElement('button', 'calendar-year-month')
        monthButton.type = 'button'
        monthButton.append(
          createElement(
            'strong',
            '',
            new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(monthDate)
          ),
          createElement('span', '', `${monthRecords.length} partida(s)`),
          createElement(
            'span',
            monthPdl === null
              ? ''
              : monthPdl > 0
                ? 'pdl-positive'
                : monthPdl < 0
                  ? 'pdl-negative'
                  : '',
            monthPdl === null ? 'Sem partidas' : `${formatPdl(monthPdl)} estimado`
          )
        )
        monthButton.addEventListener('click', () => {
          calendarPeriod = 'month'
          periodFilter.value = 'month'
          visibleMonth = monthDate
          selectedDate = dateKey(monthDate)
          render()
        })
        days.append(monthButton)
        continue
      }

      const day = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + index
      )
      const key = dateKey(day)
      const dayRecords = recordsForDate(key)
      const button = createElement('button', 'calendar-day')
      button.type = 'button'
      button.setAttribute('role', 'gridcell')
      button.setAttribute('aria-pressed', String(key === selectedDate))
      button.setAttribute(
        'aria-label',
        `${dayFormatter.format(day)}${dayRecords.length ? `, ${dayRecords.length} partida(s)` : ''}`
      )
      if (calendarPeriod === 'month' && day.getMonth() !== month) {
        button.classList.add('is-outside-month')
      }
      if (key === today) button.classList.add('is-today')
      button.append(
        createElement(
          'span',
          'calendar-day-number',
          calendarPeriod === 'week'
            ? new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric' }).format(day)
            : String(day.getDate())
        )
      )

      const outcomes = createElement('span', 'calendar-day-results')
      const resultCounts = {
        win: dayRecords.filter((record) => record.result === 'win').length,
        loss: dayRecords.filter((record) => record.result === 'loss').length,
        remake: dayRecords.filter((record) => record.result === 'remake').length
      }
      const labels: Array<[MatchResult, string]> = [
        ['win', 'VIT'],
        ['loss', 'DER'],
        ['remake', 'REM']
      ]
      for (const [result, label] of labels) {
        const count = resultCounts[result]
        if (count > 0) {
          const badge = createElement('span', `result-${result}`, `${count} ${label}`)
          badge.setAttribute(
            'aria-label',
            `${count} ${result === 'win' ? 'vitória(s)' : result === 'loss' ? 'derrota(s)' : 'remake(s)'}`
          )
          outcomes.append(badge)
        }
      }
      button.append(outcomes)

      const pdlTotal = estimatePdl(dayRecords, pdlPerWin, pdlPerLoss)
      const dailyPdl = createElement(
        'span',
        `calendar-day-pdl${pdlTotal === null ? ' is-empty' : pdlTotal > 0 ? ' pdl-positive' : pdlTotal < 0 ? ' pdl-negative' : ''}`,
        pdlTotal === null ? '—' : `${formatPdl(pdlTotal)} est.`
      )
      button.append(dailyPdl)
      button.addEventListener('click', () => {
        selectedDate = key
        selectedDayDetails.open = true
        visibleMonth = new Date(day.getFullYear(), day.getMonth(), 1)
        render()
      })
      days.append(button)
    }
    renderDayDetails()
  }

  function openDialog(record?: RankedMatch): void {
    form.reset()
    recordId.value = record?.id ?? ''
    dateInput.value = record?.date ?? selectedDate
    resultInput.value = record?.result ?? 'win'
    pdlBeforeInput.value =
      record?.pdlBefore === null || record?.pdlBefore === undefined
        ? ''
        : String(record.pdlBefore)
    pdlAfterInput.value =
      record?.pdlAfter === null || record?.pdlAfter === undefined
        ? ''
        : String(record.pdlAfter)
    championInput.replaceChildren(new Option('Selecione um campeão (opcional)', ''))
    for (const champion of champions) {
      const option = new Option(champion.name, champion.id)
      championInput.append(option)
    }
    const selectedChampion = record?.champion ? getChampion(record.champion) : undefined
    if (record?.champion && !selectedChampion) {
      championInput.add(new Option(`${record.champion} (registro anterior)`, record.champion))
      championInput.value = record.champion
    } else {
      championInput.value = selectedChampion?.id ?? ''
    }
    rankBeforeInput.value = record?.rankBefore ?? ''
    rankAfterInput.value = record?.rankAfter ?? ''
    notesInput.value = record?.notes ?? ''
    formTitle.textContent = record ? 'Editar registro' : 'Registrar partida'
    saveButton.textContent = record ? 'Salvar alterações' : 'Salvar registro'
    dialog.showModal()
  }

  pdlSettingsForm.addEventListener('submit', (event) => {
    event.preventDefault()
    if (!pdlSettingsForm.reportValidity()) return
    const pdlPerWin = Number(pdlWinInput.value)
    const pdlPerLoss = Number(pdlLossInput.value)
    if (
      !Number.isInteger(pdlPerWin) ||
      pdlPerWin < 0 ||
      pdlPerWin > 100 ||
      !Number.isInteger(pdlPerLoss) ||
      pdlPerLoss < 0 ||
      pdlPerLoss > 100
    ) {
      reportStatus('Informe valores inteiros entre 0 e 100 para vitória e derrota.', true)
      return
    }
    const updatedProfile = { ...profile, pdlPerWin, pdlPerLoss }
    if (saveRecords(records, updatedProfile)) render()
  })

  accountForm.addEventListener('submit', (event) => {
    event.preventDefault()
    if (!accountForm.reportValidity()) return
    const gameName = accountNameInput.value.trim()
    const tagLine = accountTagInput.value.trim().replace(/^#/, '')
    const platform = accountPlatformInput.value
    if (Boolean(gameName) !== Boolean(tagLine)) {
      reportStatus('Preencha o nome do jogo e a tag para formar o Riot ID.', true)
      const missingInput = gameName ? accountTagInput : accountNameInput
      missingInput.focus()
      return
    }
    if (
      gameName.includes('#') ||
      tagLine.includes('#') ||
      gameName.length > 16 ||
      tagLine.length > 8 ||
      !isRiotPlatform(platform)
    ) {
      reportStatus('Confira o nome e a tag do Riot ID; informe a tag sem #.', true)
      accountNameInput.focus()
      return
    }
    const updatedProfile: PlayerProfile = {
      ...profile,
      gameName,
      tagLine,
      platform,
      connected:
        gameName === profile.gameName &&
        tagLine === profile.tagLine &&
        platform === profile.platform
          ? profile.connected
          : false,
      matchHistoryOffset:
        gameName === profile.gameName &&
        tagLine === profile.tagLine &&
        platform === profile.platform
          ? profile.matchHistoryOffset
          : 0,
      hasMoreMatchHistory:
        gameName === profile.gameName &&
        tagLine === profile.tagLine &&
        platform === profile.platform
          ? profile.hasMoreMatchHistory
          : false
    }
    if (saveRecords(records, updatedProfile)) {
      renderProfile()
      if (gameName && tagLine) startAutomaticSync()
      else reportStatus('Perfil salvo. Informe o Riot ID para sincronizar partidas automaticamente.')
    }
  })

  disconnectButton.addEventListener('click', () => {
    if (syncInProgress) {
      reportStatus('Aguarde a sincronização atual terminar antes de desconectar.', true)
      return
    }
    stopAutomaticSync()
    const disconnectedProfile: PlayerProfile = {
      gameName: '',
      tagLine: '',
      platform: profile.platform,
      rank: '',
      pdl: null,
      rankSnapshotAt: null,
      matchHistoryOffset: 0,
      hasMoreMatchHistory: false,
      connected: false,
      pdlPerWin: profile.pdlPerWin ?? defaultPdlPerWin,
      pdlPerLoss: profile.pdlPerLoss ?? defaultPdlPerLoss
    }
    if (saveRecords(records, disconnectedProfile)) {
      accountNameInput.value = ''
      accountTagInput.value = ''
      accountPlatformInput.value = profile.platform
      renderProfile()
      reportStatus('Conta desconectada. O histórico salvo neste dispositivo foi mantido.')
    }
  })

  syncButton.addEventListener('click', () => {
    void synchronizeRankedMatches()
  })

  loadOlderMatchesButton.addEventListener('click', () => {
    void synchronizeRankedMatches(true)
  })

  function navigateToPage(selectedPage: string | undefined): void {
    if (
      selectedPage !== 'home' &&
      selectedPage !== 'match' &&
      selectedPage !== 'flash' &&
      selectedPage !== 'calendar' &&
      selectedPage !== 'voice'
    ) return
    const showHome = selectedPage === 'home'
    const showCalendar = selectedPage === 'calendar'
    homePage.hidden = !showHome
    matchPage.hidden = selectedPage !== 'match'
    flashPage.hidden = selectedPage !== 'flash'
    calendarPage.hidden = !showCalendar
    voicePage.hidden = selectedPage !== 'voice'
    pageTitle.textContent = showHome
      ? 'Bem-vindo ao Bronx I.A'
      : showCalendar
        ? 'Perfil'
        : selectedPage === 'flash'
          ? 'Flash Timing'
          : selectedPage === 'voice'
            ? 'Voz dos alertas'
            : 'Jungler Tracker'
    const workspace = document.querySelector('.workspace')
    if (workspace) {
        workspace.classList.remove('page-flare')
        void workspace.clientWidth
        workspace.classList.add('page-flare')
        window.setTimeout(() => workspace.classList.remove('page-flare'), 850)
    }
    for (const button of navigation.querySelectorAll<HTMLButtonElement>('[data-page-target]')) {
      if (button.dataset.pageTarget === selectedPage) button.setAttribute('aria-current', 'page')
      else button.removeAttribute('aria-current')
    }
    if (showCalendar) render()
  }

  navigation.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const pageButton = target.closest<HTMLButtonElement>('[data-page-target]')
    if (pageButton) navigateToPage(pageButton.dataset.pageTarget)
  })

  homePage.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const pageButton = target.closest<HTMLButtonElement>('[data-page-target]')
    if (pageButton) navigateToPage(pageButton.dataset.pageTarget)
  })

  previousMonth.addEventListener('click', () => {
    if (calendarPeriod === 'week') {
      const selected = dateFromKey(selectedDate)
      selected.setDate(selected.getDate() - 7)
      selectedDate = dateKey(selected)
      visibleMonth = new Date(selected.getFullYear(), selected.getMonth(), 1)
    } else if (calendarPeriod === 'year') {
      visibleMonth = new Date(visibleMonth.getFullYear() - 1, 0, 1)
      selectedDate = dateKey(visibleMonth)
    } else {
      visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1)
      selectedDate = dateKey(visibleMonth)
    }
    render()
  })
  nextMonth.addEventListener('click', () => {
    if (calendarPeriod === 'week') {
      const selected = dateFromKey(selectedDate)
      selected.setDate(selected.getDate() + 7)
      selectedDate = dateKey(selected)
      visibleMonth = new Date(selected.getFullYear(), selected.getMonth(), 1)
    } else if (calendarPeriod === 'year') {
      visibleMonth = new Date(visibleMonth.getFullYear() + 1, 0, 1)
      selectedDate = dateKey(visibleMonth)
    } else {
      visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1)
      selectedDate = dateKey(visibleMonth)
    }
    render()
  })
  periodFilter.addEventListener('change', () => {
    const value = periodFilter.value
    if (value !== 'week' && value !== 'month' && value !== 'year') {
      periodFilter.value = calendarPeriod
      return
    }
    calendarPeriod = value
    const anchor = dateFromKey(selectedDate)
    visibleMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    render()
  })
  todayButton.addEventListener('click', () => {
    selectedDate = dateKey(new Date())
    selectedDayDetails.open = true
    const today = dateFromKey(selectedDate)
    visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    render()
  })
  closeButton.addEventListener('click', () => dialog.close())
  cancelButton.addEventListener('click', () => dialog.close())
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close()
  })
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (!form.reportValidity()) return
    if (!isDateKey(dateInput.value)) {
      reportStatus('Escolha uma data válida para a partida.', true)
      dateInput.focus()
      return
    }
    const pdlBefore = pdlBeforeInput.value.trim() === '' ? null : Number(pdlBeforeInput.value)
    const pdlAfter = pdlAfterInput.value.trim() === '' ? null : Number(pdlAfterInput.value)
    for (const [input, value] of [
      [pdlBeforeInput, pdlBefore],
      [pdlAfterInput, pdlAfter]
    ] as const) {
      if (value !== null && (!Number.isInteger(value) || value < 0 || value > 100)) {
        reportStatus('O PDL anterior e posterior deve ser um número inteiro entre 0 e 100.', true)
        input.focus()
        return
      }
    }
    if ((pdlBefore === null) !== (pdlAfter === null)) {
      reportStatus('Informe o PDL antes e depois ou deixe os dois campos vazios.', true)
      ;(pdlBefore === null ? pdlBeforeInput : pdlAfterInput).focus()
      return
    }
    if (!isMatchResult(resultInput.value)) {
      reportStatus('Escolha um resultado válido para a partida.', true)
      resultInput.focus()
      return
    }
    const editingId = recordId.value
    const existing = editingId ? records.find((record) => record.id === editingId) : undefined
    if (editingId && !existing) {
      reportStatus('O registro que você tentou editar não foi encontrado.', true)
      dialog.close()
      return
    }
    const record: RankedMatch = {
      id: existing?.id ?? crypto.randomUUID(),
      matchId: existing?.matchId ?? null,
      source: existing?.source ?? 'manual',
      startedAt: existing?.startedAt ?? null,
      date: dateInput.value,
      result: resultInput.value,
      pdlBefore,
      pdlAfter,
      legacyPdl: pdlBefore === null ? existing?.legacyPdl ?? null : null,
      champion: championInput.value.trim(),
      rankBefore: rankBeforeInput.value.trim(),
      rankAfter: rankAfterInput.value.trim(),
      notes: notesInput.value.trim(),
      createdAt: existing?.createdAt ?? Date.now()
    }
    const updated = existing
      ? records.map((candidate) => (candidate.id === existing.id ? record : candidate))
      : [...records, record]
    if (!saveRecords(updated)) return
    selectedDate = record.date
    const recordDate = dateFromKey(record.date)
    visibleMonth = new Date(recordDate.getFullYear(), recordDate.getMonth(), 1)
    dialog.close()
    render()
  })

  renderProfile()
  loadRecords()
  if (storageReady) {
    if (profile.gameName && profile.tagLine) {
      startAutomaticSync()
    } else {
      reportStatus('Configure o Riot ID e a plataforma para importar partidas automaticamente.')
    }
  }
  render()
}
