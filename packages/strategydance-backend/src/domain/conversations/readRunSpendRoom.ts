import { getRunDailySpend } from 'strategydance-database/backend'

import type { ConversationRunReference, UsageCapScope } from '~types'

import { dataConnect } from '~firebase'

import findSpendRoom from '~domain/conversations/findSpendRoom'

/*
  How much more a run may spend today before a daily spend ceiling is passed, in microdollars, and
  whose ceiling that is: what the scope's other runs may have cost, read in one snapshot with what
  the run's own row holds, so the worker adds its own ledger as it stands rather than as it last
  wrote it, set against each ceiling, with what each scope's other runs may have cost and what its
  rows summed to, its own included
*/
async function readRunSpendRoom(
  { organizationId, userId, runId }: Pick<ConversationRunReference, 'organizationId' | 'userId' | 'runId'>,
  ceilings: Record<UsageCapScope, number>,
) {
  const { data } = await getRunDailySpend(dataConnect, { organizationId, userId, runId })
  const own = Number(data.own[0]?.costBound ?? 0)
  const read = (sum: { costBound_sum?: string | null }[]) => Number(sum[0]?.costBound_sum ?? 0)
  const sums = { member: read(data.member), account: read(data.account), organization: read(data.organization) }
  const others = { member: sums.member - own, account: sums.account - own, organization: sums.organization - own }

  return { ...findSpendRoom(others, ceilings), others, sums }
}

export default readRunSpendRoom
