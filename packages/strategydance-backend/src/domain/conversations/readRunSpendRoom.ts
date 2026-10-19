import { getRunDailySpend } from 'strategydance-database/backend'

import type { ConversationRunReference, UsageCapScope } from '~types'

import { dataConnect } from '~firebase'

import findSpendRoom from '~domain/conversations/findSpendRoom'

/*
  How much more a run may spend today before a daily spend ceiling is passed, in microdollars, and
  whose ceiling that is: what the scope's other runs may have cost, read in one snapshot with what
  the run's own row holds, so the worker adds its own ledger as it stands rather than as it last
  wrote it, set against each ceiling
*/
async function readRunSpendRoom(
  { organizationId, userId, runId }: Pick<ConversationRunReference, 'organizationId' | 'userId' | 'runId'>,
  ceilings: Record<UsageCapScope, number>,
) {
  const { data } = await getRunDailySpend(dataConnect, { organizationId, userId, runId })
  const own = Number(data.own[0]?.costBound ?? 0)
  const others = (sum: { costBound_sum?: string | null }[]) => Number(sum[0]?.costBound_sum ?? 0) - own

  return findSpendRoom(
    { member: others(data.member), account: others(data.account), organization: others(data.organization) },
    ceilings,
  )
}

export default readRunSpendRoom
