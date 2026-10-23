export type LiveClientJungler = {
  championName: string
  hasSmite: boolean
  source: 'position' | 'smite'
}

export type LiveClientJunglerResult =
  | {
      status: 'available'
      jungler: LiveClientJungler | null
      ownTeamSide: 'blue' | 'red'
    }
  | { status: 'unavailable'; message: string }
