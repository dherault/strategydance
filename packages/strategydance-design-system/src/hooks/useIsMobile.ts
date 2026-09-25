import { useSyncExternalStore } from 'react'

// Tailwind's `md`, below which the sidebar becomes a sheet
const MOBILE_BREAKPOINT = 768

const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mediaQueryList = window.matchMedia(query)

  mediaQueryList.addEventListener('change', onChange)

  return () => mediaQueryList.removeEventListener('change', onChange)
}

function getSnapshot() {
  return window.matchMedia(query).matches
}

// Rendered without a window, as a prerendered shell is, there is no viewport to be narrow
function getServerSnapshot() {
  return false
}

/*
  Whether the viewport is narrower than `md`. An external store rather than state set from an
  effect, so the first client render already has the answer instead of correcting itself
*/
function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export default useIsMobile
