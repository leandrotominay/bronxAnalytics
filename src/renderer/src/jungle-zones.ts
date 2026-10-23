export type MapSide = 'blue' | 'red'

type JungleCamp = 'blue-buff' | 'red-buff' | 'wolves' | 'raptors' | 'gromp' | 'krugs'

export type JungleZone =
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

type Point = { x: number; y: number }

export function classifyJungleZone(point: Point): JungleZone | null {
  if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return null

  if (Math.hypot(point.x - 0.3, point.y - 0.16) <= 0.035) return 'baron-pit'
  if (Math.hypot(point.x - 0.8, point.y - 0.8) <= 0.045) return 'dragon-pit'

  const campAnchors: Array<{
    name: JungleCamp
    side: MapSide
    x: number
    y: number
  }> = [
    { name: 'blue-buff', side: 'blue', x: 0.22, y: 0.475 },
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
  if (nearestCamp && nearestCampDistance <= 0.045) {
    return `camp:${nearestCamp.side}:${nearestCamp.name}`
  }

  const riverDistance = Math.abs(point.x - point.y) / Math.SQRT2
  if (riverDistance <= 0.05) {
    if (point.x < 0.38) return 'river-top'
    if (point.x > 0.62) return 'river-bot'
    return 'river-mid'
  }

  if (Math.hypot(point.x - 0.06, point.y - 0.94) <= 0.07) return 'blue-base'
  if (Math.hypot(point.x - 0.94, point.y - 0.06) <= 0.07) return 'red-base'

  const distanceToMid = Math.abs(point.x + point.y - 1) / Math.SQRT2
  if (distanceToMid <= 0.04) return 'mid-lane'
  if (point.x < 0.065 || point.y < 0.065) return 'top-lane'
  if (point.x > 0.935 || point.y > 0.935) return 'bot-lane'

  return point.x < point.y ? 'jungle:blue' : 'jungle:red'
}

export function formatJungleZone(zone: JungleZone, ownSide: MapSide | null): string {
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
