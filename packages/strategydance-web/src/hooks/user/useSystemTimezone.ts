import { useCallback, useEffect, useState } from 'react'
import { resolveSystemTimezone } from 'strategydance-core'

/*
  The reader's IANA time zone, re-read whenever they come back to the tab.

  There is no event for the zone changing, so a laptop that travels and wakes up in another
  country would otherwise keep the value it resolved on load until the page was reloaded.
  Returning to the tab is the moment worth asking again at, since it is what somebody does
  after opening the lid, and the answer is a string: an unchanged one is the same string, which
  React bails out of rather than re-rendering for
*/
function useSystemTimezone() {
  const [timezone, setTimezone] = useState(resolveSystemTimezone)

  const recheck = useCallback(() => {
    setTimezone(resolveSystemTimezone())
  }, [])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') recheck()
    }

    window.addEventListener('focus', recheck)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', recheck)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [
    recheck,
  ])

  return timezone
}

export default useSystemTimezone
