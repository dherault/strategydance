import type { UsageCapScope } from '~types'

// What a run may have cost, as the report reads it of the last 24 hours (`RunSpend`)
export type ReportedRunSpend = {
  userId: string
  organizationId: string
  costBound: string
  user: { email: string } | null
}

// One scope's day: whose, what its runs may have cost and its ceiling, in microdollars
export type DailySpend = {
  userId: string | null
  email: string | null
  organizationId: string | null
  microdollars: number
  ceiling: number
}

/*
  What the runs of the last 24 hours may have cost in each scope the daily spend ceilings hold, the
  member's in each organization, each account's across its organizations and each organization's,
  against its ceiling, dearest first: what `report:usage` prints beside the ledgers, so a ceiling
  is set again from the days it held
*/
function summarizeDailySpend(spends: ReportedRunSpend[], ceilings: Record<UsageCapScope, number>) {
  const members = new Map<string, DailySpend>()
  const accounts = new Map<string, DailySpend>()
  const organizations = new Map<string, DailySpend>()

  for (const spend of spends) {
    const microdollars = Number(spend.costBound)
    const email = spend.user?.email ?? null
    const scopes = [
      [
        members,
        `${spend.userId}:${spend.organizationId}`,
        { userId: spend.userId, email, organizationId: spend.organizationId, ceiling: ceilings.member },
      ],
      [accounts, spend.userId, { userId: spend.userId, email, organizationId: null, ceiling: ceilings.account }],
      [
        organizations,
        spend.organizationId,
        { userId: null, email: null, organizationId: spend.organizationId, ceiling: ceilings.organization },
      ],
    ] as const

    for (const [scope, key, whose] of scopes) {
      const day = scope.get(key) ?? { ...whose, microdollars: 0 }

      day.microdollars += microdollars
      scope.set(key, day)
    }
  }

  const byShare = (a: DailySpend, b: DailySpend) => b.microdollars / b.ceiling - a.microdollars / a.ceiling

  return {
    members: [...members.values()].toSorted(byShare),
    accounts: [...accounts.values()].toSorted(byShare),
    organizations: [...organizations.values()].toSorted(byShare),
  }
}

export default summarizeDailySpend
