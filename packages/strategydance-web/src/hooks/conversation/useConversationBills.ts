import type { Bill } from '~types'

import useBills from '~hooks/budget/useBills'

/*
  The organization's bills as a conversation's thread looks them up, by id, kept live, so a bill the
  agent deleted that somebody restored since, on the Budget page or from the row, is back in it at
  once. Read only once the thread `needs` it, and null until it has landed, or when it could not be
  read, when the row offers nothing. The bills leave deleted ones out, so an id they lack names one
  deleted, pruned or never there
*/
function useConversationBills(needs: boolean): ReadonlyMap<string, Bill> | null {
  const { data, initialLoading, hasFailed } = useBills({ isEnabled: needs })

  if (!needs || initialLoading || hasFailed) return null

  return new Map(data.map(bill => [bill.id.replaceAll('-', '').toLowerCase(), bill]))
}

export default useConversationBills
