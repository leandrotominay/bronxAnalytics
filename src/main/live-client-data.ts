import { request } from 'node:https'
import type {
  LiveClientRosterPlayer,
  LiveClientRosterResult
} from '../shared/live-client-data'
import { riotGamesRootCertificate } from './riotgames-certificate'

const maximumResponseBytes = 1_000_000
const requestTimeoutMs = 3_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeIdentifier(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  return value.trim().toLocaleLowerCase()
}

type ParsedLiveClientMatch = {
  players: LiveClientRosterPlayer[]
  ownTeamSide: 'blue' | 'red'
}

function parseLiveClientMatch(data: unknown): ParsedLiveClientMatch {
  if (!isRecord(data) || !isRecord(data.activePlayer) || !Array.isArray(data.allPlayers)) {
    throw new Error('A resposta da API local não contém os dados esperados da partida.')
  }

  const allPlayers = data.allPlayers
  if (allPlayers.some((player) => !isRecord(player))) {
    throw new Error('A lista de jogadores da API local contém dados inválidos.')
  }
  if (
    allPlayers.some(
      (player) => isRecord(player) && player.team !== 'ORDER' && player.team !== 'CHAOS'
    )
  ) {
    throw new Error('A lista de jogadores da API local contém um time inválido.')
  }

  const activePlayer = data.activePlayer
  const playerRecords = allPlayers.filter(isRecord)
  let ownTeam: string | null = null
  for (const key of ['riotId', 'summonerName', 'riotIdGameName']) {
    const activeIdentifier = normalizeIdentifier(activePlayer[key])
    if (!activeIdentifier) continue
    const matchingTeams = [...new Set(
      playerRecords
        .filter((player) => {
          const candidateIdentifiers =
            key === 'summonerName'
              ? [player.summonerName, player.riotIdGameName]
              : [player[key]]
          return candidateIdentifiers.some(
            (identifier) => normalizeIdentifier(identifier) === activeIdentifier
          )
        })
        .map((player) => player.team)
        .filter((team): team is string => team === 'ORDER' || team === 'CHAOS')
    )]
    if (matchingTeams.length === 1) {
      ownTeam = matchingTeams[0] ?? null
      break
    }
  }
  if (!ownTeam) {
    throw new Error('Não foi possível determinar com segurança o time do jogador local.')
  }

  const enemyRows = allPlayers.filter(
    (player) => isRecord(player) && player.team !== ownTeam
  )
  if (enemyRows.length === 0) {
    throw new Error('A API local não retornou jogadores do time inimigo.')
  }

  const players = enemyRows.map((player, index) => {
    if (
      !isRecord(player) ||
      typeof player.championName !== 'string' ||
      player.championName.trim().length === 0
    ) {
      throw new Error(`A API local não informou o campeão do oponente ${index + 1}.`)
    }
    return {
      id: `enemy-player-${index}`,
      championName: player.championName.trim(),
      position: typeof player.position === 'string' ? player.position.trim() : ''
    }
  })
  return {
    players,
    ownTeamSide: ownTeam === 'ORDER' ? 'blue' : 'red'
  }
}

export function parseLiveClientRoster(data: unknown): LiveClientRosterPlayer[] {
  return parseLiveClientMatch(data).players
}

function requestGameData(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const requestHandle = request(
      {
        hostname: '127.0.0.1',
        port: 2999,
        path: '/liveclientdata/allgamedata',
        method: 'GET',
        headers: { Accept: 'application/json' },
        ca: riotGamesRootCertificate,
        rejectUnauthorized: true,
        timeout: requestTimeoutMs
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume()
          reject(new Error(`A API local retornou HTTP ${response.statusCode ?? 'desconhecido'}.`))
          return
        }

        const chunks: Buffer[] = []
        let responseBytes = 0
        response.on('data', (chunk: Buffer) => {
          responseBytes += chunk.length
          if (responseBytes > maximumResponseBytes) {
            response.destroy(new Error('A resposta da API local excede o limite permitido.'))
            return
          }
          chunks.push(chunk)
        })
        response.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown)
          } catch (error) {
            reject(new Error('A API local retornou JSON inválido.', { cause: error }))
          }
        })
        response.on('error', reject)
      }
    )
    requestHandle.setTimeout(requestTimeoutMs, () => {
      requestHandle.destroy(new Error('Tempo limite ao consultar a API local do jogo.'))
    })
    requestHandle.on('error', reject)
    requestHandle.end()
  })
}

export async function readLiveClientRoster(): Promise<LiveClientRosterResult> {
  try {
    const gameData = await requestGameData()
    return { status: 'available', ...parseLiveClientMatch(gameData) }
  } catch (error) {
    if (!(error instanceof Error)) throw error
    return {
      status: 'unavailable',
      message: error.message
    }
  }
}
