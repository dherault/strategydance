import { describe, expect, test } from 'bun:test'

import findPassedSpendCeilings from './findPassedSpendCeilings'

const CEILINGS = { member: 25_000_000, account: 50_000_000, organization: 150_000_000 }

describe('findPassedSpendCeilings', () => {
  test('finds none while what is asked fits every scope, up to each ceiling', () => {
    expect(
      findPassedSpendCeilings({ member: 23_000_000, account: 48_000_000, organization: 0 }, CEILINGS, 2_000_000),
    ).toEqual([])
  })

  test('names each ceiling passed, with how much of its window has to leave first', () => {
    expect(
      findPassedSpendCeilings(
        { member: 24_000_000, account: 49_500_000, organization: 100_000_000 },
        CEILINGS,
        2_000_000,
      ),
    ).toEqual([
      { scope: 'member', max: 25_000_000, need: 1_000_000 },
      { scope: 'account', max: 50_000_000, need: 1_500_000 },
    ])
  })
})
