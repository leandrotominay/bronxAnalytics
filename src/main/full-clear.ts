import type { ChampionFullClear } from '../shared/full-clear'

const fullClearSheetUrl =
  'https://docs.google.com/spreadsheets/d/1jE8bnlnIJnmWv9pnVW9veMKRXJNaaJf5tneQB3xUkbI/export?format=csv&gid=1938238048'
const maximumSheetSize = 2_000_000
let sheetCsvPromise: Promise<string> | null = null

function parseCsv(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let insideQuotes = false

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]
    if (insideQuotes) {
      if (character === '"' && csv[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (character === '"') {
        insideQuotes = false
      } else {
        cell += character
      }
    } else if (character === '"' && cell.length === 0) {
      insideQuotes = true
    } else if (character === ',') {
      row.push(cell)
      cell = ''
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && csv[index + 1] === '\n') index += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function normalizeChampionName(name: string): string {
  return name.toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
}

function parseTimeSeconds(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)$/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

function comparePatches(left: string, right: string): number {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)
  const partCount = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < partCount; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

export function findChampionFullClear(
  csv: string,
  championName: string
): ChampionFullClear | null {
  const normalizedChampion = normalizeChampionName(championName)
  const rows = parseCsv(csv)
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => cell.trim().toLocaleLowerCase() === 'champion')
  )
  if (headerIndex < 0) throw new Error('A planilha não contém a coluna Champion.')

  const headers = rows[headerIndex].map((header) => header.trim().toLocaleLowerCase())
  const championIndex = headers.indexOf('champion')
  const patchIndex = headers.indexOf('patch')
  const campsIndex = headers.indexOf('camps')
  const timeIndex = headers.indexOf('time')
  if (patchIndex < 0 || campsIndex < 0 || timeIndex < 0) {
    throw new Error('A planilha não contém as colunas Patch, Camps e Time.')
  }

  const matches = rows.slice(headerIndex + 1).flatMap((row) => {
    if (normalizeChampionName(row[championIndex] ?? '') !== normalizedChampion) return []
    if (row[campsIndex]?.trim() !== '6') return []
    const patch = row[patchIndex]?.trim() ?? ''
    const timeSeconds = parseTimeSeconds(row[timeIndex] ?? '')
    if (!/^\d+(?:\.\d+)*$/.test(patch) || timeSeconds === null) return []
    return [{ championName: row[championIndex].trim(), patch, timeSeconds }]
  })
  if (matches.length === 0) return null

  const latestPatch = matches.reduce(
    (latest, entry) => comparePatches(entry.patch, latest) > 0 ? entry.patch : latest,
    matches[0].patch
  )

  return matches
    .filter((entry) => entry.patch === latestPatch)
    .reduce((fastest, entry) => entry.timeSeconds < fastest.timeSeconds ? entry : fastest)
}

async function loadSheetCsv(): Promise<string> {
  if (!sheetCsvPromise) {
    sheetCsvPromise = fetch(fullClearSheetUrl, {
      headers: { Accept: 'text/csv' },
      signal: AbortSignal.timeout(15_000)
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`A planilha respondeu com HTTP ${response.status}.`)
        }
        const contentLength = Number(response.headers.get('content-length'))
        if (Number.isFinite(contentLength) && contentLength > maximumSheetSize) {
          throw new Error('A planilha excede o tamanho permitido.')
        }
        const csv = await response.text()
        if (csv.length > maximumSheetSize) {
          throw new Error('A planilha excede o tamanho permitido.')
        }
        return csv
      })
      .catch((error: unknown) => {
        sheetCsvPromise = null
        throw error
      })
  }
  return sheetCsvPromise
}

export async function readChampionFullClear(championName: string): Promise<ChampionFullClear | null> {
  return findChampionFullClear(await loadSheetCsv(), championName)
}
