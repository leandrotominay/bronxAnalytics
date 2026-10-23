export {}

const alertElement = document.querySelector<HTMLDivElement>('#overlay-alert')
if (!alertElement) throw new Error('The in-game overlay alert element was not found.')
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

window.companion.notifyOverlayReady()
