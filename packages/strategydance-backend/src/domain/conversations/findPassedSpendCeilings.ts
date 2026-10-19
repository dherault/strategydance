import type { UsageCapScope } from '~types'

const SCOPES: UsageCapScope[] = ['member', 'account', 'organization']

// A daily spend ceiling something would pass: whose, its value, and how much would have to leave
// the window before it fits, in microdollars
export type PassedSpendCeiling = { scope: UsageCapScope; max: number; need: number }

/*
  The daily spend ceilings `cost` microdollars more would pass, from what each scope may have spent:
  the member's in the organization, the account's and the organization's, each with how much of its
  window would have to leave first. None when it fits all three
*/
function findPassedSpendCeilings(
  spent: Record<UsageCapScope, number>,
  ceilings: Record<UsageCapScope, number>,
  cost: number,
): PassedSpendCeiling[] {
  return SCOPES.flatMap(scope => {
    const need = spent[scope] + cost - ceilings[scope]

    return need > 0 ? [{ scope, max: ceilings[scope], need }] : []
  })
}

export default findPassedSpendCeilings
