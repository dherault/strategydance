import type { UsageCapScope } from '~types'

// A scope's sum, as a read of the daily spend answers it: one row, or none when nothing was counted
type SpendSum = { costBound_sum?: string | null }[]

// What each scope's rows of a daily spend read summed to, in microdollars, nothing for one without
function toSpendSums(read: Record<UsageCapScope, SpendSum>): Record<UsageCapScope, number> {
  const toSum = (sum: SpendSum) => Number(sum[0]?.costBound_sum ?? 0)

  return { member: toSum(read.member), account: toSum(read.account), organization: toSum(read.organization) }
}

export default toSpendSums
