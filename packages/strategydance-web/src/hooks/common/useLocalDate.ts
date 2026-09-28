import { useEffect, useState } from 'react'

import getLocalDate from '~utils/date/getLocalDate'

// How often the day is checked while the tab is open, which is how late it can turn over
const RECHECK_INTERVAL_MS = 60 * 1000

/*
  Today, as `YYYY-MM-DD`, in a time zone: the system's when none is given, or somebody else's,
  such as the teammate whose checklist is on screen.

  A page left open overnight turns over by itself: the day is checked every minute and whenever
  the reader comes back to the tab, which is what a laptop does on waking. The state only
  changes when the day does, so nothing re-renders in between
*/
function useLocalDate(timeZone?: string | null) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    function recheck() {
      const next = new Date()

      setNow(current => (getLocalDate(current, timeZone) === getLocalDate(next, timeZone) ? current : next))
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') recheck()
    }

    const interval = setInterval(recheck, RECHECK_INTERVAL_MS)

    window.addEventListener('focus', recheck)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', recheck)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [timeZone])

  return getLocalDate(now, timeZone)
}

export default useLocalDate
