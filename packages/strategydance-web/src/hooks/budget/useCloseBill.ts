import { useNavigate, useRouter, useSearch } from '@tanstack/react-router'

import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

// The history entries of the bills already closed, by their key, so a bill's address is left once
// however many times it is asked: its dialog and its bouncer each close it, and a second Back would
// leave the Budget page, or the app
const closedEntries = new Set<string>()

/*
  Closes a bill's dialog: back to the Budget page's own entry when the page opened the bill, which
  its history entry says through a reload, else to the page on the tab the bill lay over, replacing
  the bill's address. Once per history entry, so a dialog closed while it saves, or a bill deleted
  as its dialog closes, goes back once
*/
function useCloseBill() {
  const navigate = useNavigate()
  const router = useRouter()
  const search = useSearch({ from: '/_authenticated/_app/$organizationSlug/budget/$billId' })
  const organizationSlug = useCurrentOrganizationSlug()

  return function closeBill() {
    const { state } = router.state.location
    const entry = state.__TSR_key ?? router.state.location.href

    if (closedEntries.has(entry)) return

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

export default useCloseBill
