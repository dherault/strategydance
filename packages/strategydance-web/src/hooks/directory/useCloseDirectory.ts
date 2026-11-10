import { useNavigate, useRouter, useSearch } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

// The history entries of the directories closed in their current visit, by their key, so a
// directory's address is left once however many times it is asked, as a bill's is (`useCloseBill`)
const closedEntries = new Set<string>()

/*
  Closes a directory's dialog opened at its address: back to the Directories page's own entry when
  the page opened it, which its history entry says through a reload, else to the page on the tab
  the directory lay over, replacing the directory's address. Once per history entry, and only while
  the visit that asked is on screen, from the directory's own entry, as `useCloseBill` explains
*/
function useCloseDirectory() {
  const navigate = useNavigate()
  const router = useRouter()
  const search = useSearch({ from: '/_authenticated/_app/$organizationSlug/directories/$directoryId' })
  const organizationSlug = useCurrentOrganizationSlug()
  const [directoryEntry] = useState(() => readEntry(router.state.location))
  const isMountedRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    closedEntries.delete(directoryEntry)

    return () => {
      isMountedRef.current = false
    }
  }, [directoryEntry])

  return function closeDirectory() {
    const { state } = router.state.location
    const entry = readEntry(router.state.location)

    if (!isMountedRef.current || entry !== directoryEntry || closedEntries.has(entry)) return

    closedEntries.add(entry)

    if (state.isFromDirectoriesPage === true) {
      router.history.back()

      return
    }

    navigate({
      to: '/$organizationSlug/directories',
      params: { organizationSlug },
      search: { view: search.view },
      replace: true,
      resetScroll: false,
    })
  }
}

// A history entry's key, or its address when it has none
function readEntry(location: { state: { __TSR_key?: string }; href: string }) {
  return location.state.__TSR_key ?? location.href
}

export default useCloseDirectory
