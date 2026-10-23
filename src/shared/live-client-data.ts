export type LiveClientRosterPlayer = {
  id: string
  championName: string
  position: string
}

export type LiveClientRosterResult =
  | {
      status: 'available'
      players: LiveClientRosterPlayer[]
      ownTeamSide: 'blue' | 'red'
    }
  | { status: 'unavailable'; message: string }
