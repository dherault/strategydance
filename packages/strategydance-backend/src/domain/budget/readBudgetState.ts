import { getBudgetForAgent } from 'strategydance-database/backend'

import type { BudgetState, ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

import toAgentBill from '~domain/budget/toAgentBill'
import toMemberToday from '~domain/budget/toMemberToday'

type ReadBudgetStateResult = { outcome: 'notMember' } | { outcome: 'read'; state: BudgetState }

/*
  The budget, the live bills and the team, as every tool of the Budget module reads them, on the
  member's today. A caller who is no longer the member the module read is refused rather than shown
  no bills. Without a budget the conversions are in US dollars, as the page's are
*/
async function readBudgetState(caller: ModuleCaller): Promise<ReadBudgetStateResult> {
  const { data } = await getBudgetForAgent(dataConnect, {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
  })
  const [membership] = data.membership

  if (!membership) return { outcome: 'notMember' }

  const [budget] = data.budgets

  return {
    outcome: 'read',
    state: {
      budget:
        budget?.amountMinor != null && budget.period != null
          ? { amountMinor: Number(budget.amountMinor), period: budget.period }
          : null,
      currency: budget?.currency ?? 'USD',
      bills: data.bills.map(toAgentBill),
      members: data.members.map(member => ({ id: member.userId, name: member.user.displayName ?? null })),
      today: toMemberToday(membership.user.timezone),
    },
  }
}

export default readBudgetState
