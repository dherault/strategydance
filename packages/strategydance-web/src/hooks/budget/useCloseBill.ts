import { useNavigate, useRouter, useSearch } from '@tanstack/react-router'
import { useState } from 'react'

import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

// The history entries of the bills already closed, by their key, so a bill's address is left once
// however many times it is asked: its dialog and its bouncer each close it, and a second Back would
// leave the Budget page, or the app
const closedEntries = new Set<string>()

/*
  Closes a bill's dialog: back to the Budget page's own entry when the page opened the bill, which
  its history entry says through a reload, else to the page on the tab the bill lay over, replacing
  the bill's address. Once per history entry, so a dialog closed while it saves, or a bill deleted
  as its dialog closes, goes back once, and only from the bill's own entry, taken as it opened: a
  save landing after the reader went on to another bill or page closes nothing of theirs
*/
function useCloseBill() {
  const navigate = useNavigate()
  const router = useRouter()
  const search = useSearch({ from: '/_authenticated/_app/$organizationSlug/budget/$billId' })
  const organizationSlug = useCurrentOrganizationSlug()
  const [billEntry] = useState(() => readEntry(router.state.location))

  return function closeBill() {
    const { state } = router.state.location
    const entry = readEntry(router.state.location)

    if (entry !== billEntry || closedEntries.has(entry)) return

    closedEntries.add(entry)

    if (state.isFromBudgetPage === true) {
      router.history.back()

      return
    }

    const view = search.view ?? 'bills'

    navigate({
      to: '/$organizationSlug/budget',
      params: { organizationSlug },
      search: { view: view === 'expenses' ? undefined : view },
      replace: true,
      resetScroll: false,
    })
  }
}

// A history entry's key, or its address when it has none
function readEntry(location: { state: { __TSR_key?: string }; href: string }) {
  return location.state.__TSR_key ?? location.href
}

export default useCloseBill
