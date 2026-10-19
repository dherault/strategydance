import type { UsageCapScope } from '~types'

const SCOPES: UsageCapScope[] = ['member', 'account', 'organization']

/*
  How much more may be spent today before a daily spend ceiling is passed, in microdollars, and
  whose ceiling that is: of the member's in the organization, the account's and the organization's,
  the one with the least room left, from what each scope may have spent. Room can be below nothing,
  as the requests in flight at once across a scope can each pass it
*/
function findSpendRoom(spent: Record<UsageCapScope, number>, ceilings: Record<UsageCapScope, number>) {
  let tightest: { scope: UsageCapScope; room: number } | null = null

  for (const scope of SCOPES) {
    const room = ceilings[scope] - spent[scope]

    if (!tightest || room < tightest.room) tightest = { scope, room }
  }

  return tightest as { scope: UsageCapScope; room: number }
}

export default findSpendRoom
