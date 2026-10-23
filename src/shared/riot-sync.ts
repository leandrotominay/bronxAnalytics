export const riotPlatforms = [
  'BR1',
  'NA1',
  'LA1',
  'LA2',
  'EUW1',
  'EUN1',
  'TR1',
  'RU',
  'KR',
  'JP1',
  'OC1',
  'PH2',
  'SG2',
  'TH2',
  'TW2',
  'VN2'
] as const

export type RiotPlatform = (typeof riotPlatforms)[number]

export function isRiotPlatform(value: unknown): value is RiotPlatform {
  return typeof value === 'string' && riotPlatforms.includes(value as RiotPlatform)
}

export interface RiotSyncRequest {
  gameName: string
  tagLine: string
  platform: RiotPlatform
  start?: number
}

export interface RiotSyncMatch {
  matchId: string
  startedAt: number
  result: 'win' | 'loss'
  champion: string
  durationSeconds: number
  stats: {
    kills: number
    deaths: number
    assists: number
    cs: number
    goldEarned: number
    damageToChampions: number
  }
}

export interface RiotSyncRank {
  tier: string
  division: string
  leaguePoints: number
}

export interface RiotSyncResponse {
  matches: RiotSyncMatch[]
  rank: RiotSyncRank | null
  rankObservedAt: number
  nextStart: number | null
}
