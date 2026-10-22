export {}

const alertElement = document.querySelector<HTMLDivElement>('#overlay-alert')
if (!alertElement) throw new Error('The in-game overlay alert element was not found.')

let hideTimer: number | null = null

window.companion.onOverlayAlert((title) => {
  alertElement.textContent = title
  alertElement.classList.add('is-visible')

  if (hideTimer !== null) window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(() => {
    alertElement.classList.remove('is-visible')
    hideTimer = null
  }, 7000)
})
