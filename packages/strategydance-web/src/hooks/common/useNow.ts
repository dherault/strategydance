import { useEffect, useState } from 'react'

// How often the time is read again while the tab is open
const TICK_INTERVAL_MS = 60 * 1000

/*
  The time now, in milliseconds, for a label such as "Edited 5 minutes ago" that has to age while
  the page stays open. Read again every minute and whenever the reader comes back to the tab, and
  never during a render, which the compiler would refuse to memoize
*/
function useNow() {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    function tick() {
      setNow(Date.now())
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') tick()
    }

    const interval = setInterval(tick, TICK_INTERVAL_MS)

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return now
}

export default useNow
