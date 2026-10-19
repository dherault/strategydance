import type { UsageCapScope } from '~types'

const SCOPES: UsageCapScope[] = ['member', 'account', 'organization']

/*
  A daily spend ceiling something would pass: whose, its value, how much would have to leave the
  window before it fits, in microdollars, and what the scope's rows summed to as read, which a later
  read of the rows sets its own sum against, the window having moved on meanwhile
*/
export type PassedSpendCeiling = { scope: UsageCapScope; max: number; need: number; counted: number }

/*
  The daily spend ceilings `cost` microdollars more would pass, from what each scope may have spent:
  the member's in the organization, the account's and the organization's, each with how much of its
  window would have to leave first. None when it fits all three. `counted` is what the scope's rows
  summed to, which is what was spent unless the caller set some of it apart, as a run sets its own
*/
function findPassedSpendCeilings(
  spent: Record<UsageCapScope, number>,
  ceilings: Record<UsageCapScope, number>,
  cost: number,
  counted: Record<UsageCapScope, number> = spent,
): PassedSpendCeiling[] {
  return SCOPES.flatMap(scope => {
    const need = spent[scope] + cost - ceilings[scope]

    return need > 0 ? [{ scope, max: ceilings[scope], need, counted: counted[scope] }] : []
  })
}

export default findPassedSpendCeilings
