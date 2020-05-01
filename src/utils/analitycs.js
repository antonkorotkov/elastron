let trackEvent = (a, b, c, d) => {}

if (typeof window.require === 'function') {
  const { getGlobal } = window.require('electron').remote
  trackEvent = getGlobal('trackEvent')
}

export { trackEvent }
