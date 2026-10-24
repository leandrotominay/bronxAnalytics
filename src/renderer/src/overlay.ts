export {}

import type { SpellTimingMarker } from '../../shared/spell-timing'

const alertElement = document.querySelector<HTMLDivElement>('#overlay-alert')
if (!alertElement) throw new Error('The in-game overlay alert element was not found.')
const spellTimersElement = document.querySelector<HTMLElement>('#spell-timers')
if (!spellTimersElement) throw new Error('The spell timing overlay element was not found.')
const markerElement = document.querySelector<HTMLDivElement>('#overlay-last-seen-marker')
if (!markerElement) throw new Error('The last-seen minimap marker element was not found.')
const lastSeenMarker = markerElement

let hideTimer: number | null = null
let markerHideTimer: number | null = null

function hideLastSeenMarker(): void {
  lastSeenMarker.hidden = true
  markerHideTimer = null
}

window.companion.onOverlayAlert((title) => {
  alertElement.textContent = title
  alertElement.classList.toggle(
    'is-disappearance',
    title.startsWith('Jungler desapareceu da visão.')
  )
  alertElement.classList.add('is-visible')

  if (hideTimer !== null) window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(() => {
    alertElement.classList.remove('is-visible')
    hideTimer = null
  }, 7000)
})

window.companion.onOverlayMarker((marker) => {
  if (markerHideTimer !== null) {
    window.clearTimeout(markerHideTimer)
    markerHideTimer = null
  }
  if (!marker) {
    hideLastSeenMarker()
    return
  }
  lastSeenMarker.style.left = `${marker.x * 100}%`
  lastSeenMarker.style.top = `${marker.y * 100}%`
  lastSeenMarker.style.setProperty('--marker-size', `${marker.size * 100}vw`)
  lastSeenMarker.hidden = false
  markerHideTimer = window.setTimeout(hideLastSeenMarker, 10_000)
})

window.companion.onOverlaySpellTimers((markers) => {
  spellTimersElement.replaceChildren()
  spellTimersElement.hidden = markers.length === 0
  for (const marker of markers) {
    const item = document.createElement('article')
    item.className = 'spell-timer'
    const championIcon = document.createElement('img')
    championIcon.className = 'spell-timer-champion'
    championIcon.src = marker.championIconUrl
    championIcon.alt = marker.championName
    const flashIcon = document.createElement('img')
    flashIcon.className = 'spell-timer-flash'
    flashIcon.src = marker.flashIconUrl
    flashIcon.alt = 'Flash'
    const details = document.createElement('div')
    details.className = 'spell-timer-details'
    const championName = document.createElement('strong')
    championName.textContent = marker.championName
    const remaining = document.createElement('span')
    remaining.className = 'spell-timer-countdown'
    remaining.textContent =
      `${Math.floor(marker.remainingSeconds / 60)}:${String(marker.remainingSeconds % 60).padStart(2, '0')}`
    details.append(championName, remaining)
    item.append(championIcon, flashIcon, details)
    spellTimersElement.append(item)
  }
})

window.companion.notifyOverlayReady()
