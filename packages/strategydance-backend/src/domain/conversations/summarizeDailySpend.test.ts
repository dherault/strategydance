import { describe, expect, test } from 'bun:test'

import summarizeDailySpend from './summarizeDailySpend'

const CEILINGS = { member: 25_000_000, account: 50_000_000, organization: 150_000_000 }

function spend(userId: string, organizationId: string, dollars: number) {
  return { userId, organizationId, costBound: String(dollars * 1_000_000), user: { email: `${userId}@example.com` } }
}

describe('summarizeDailySpend', () => {
  test('sums each member in each organization, each account and each organization, nearest its ceiling first', () => {
    const summary = summarizeDailySpend(
      [spend('ada', 'acme', 20), spend('ada', 'acme', 3), spend('ada', 'globex', 10), spend('bob', 'acme', 24)],
      CEILINGS,
    )

    expect(
      summary.members.map(({ email, organizationId, microdollars }) => [email, organizationId, microdollars]),
    ).toEqual([
      ['bob@example.com', 'acme', 24_000_000],
      ['ada@example.com', 'acme', 23_000_000],
      ['ada@example.com', 'globex', 10_000_000],
    ])
    expect(summary.accounts.map(({ email, microdollars, ceiling }) => [email, microdollars, ceiling])).toEqual([
      ['ada@example.com', 33_000_000, 50_000_000],
      ['bob@example.com', 24_000_000, 50_000_000],
    ])
    expect(summary.organizations.map(({ organizationId, microdollars }) => [organizationId, microdollars])).toEqual([
      ['acme', 47_000_000],
      ['globex', 10_000_000],
    ])
  })
})
