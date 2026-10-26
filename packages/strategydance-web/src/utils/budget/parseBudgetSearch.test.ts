import { describe, expect, it } from 'bun:test'

import parseBudgetSearch from '~utils/budget/parseBudgetSearch'

describe('parseBudgetSearch', () => {
  it('reads each tab', () => {
    expect(parseBudgetSearch({ view: 'revenue' })).toEqual({ view: 'revenue' })
    expect(parseBudgetSearch({ view: 'expenses' })).toEqual({ view: 'expenses' })
    expect(parseBudgetSearch({ view: 'bills' })).toEqual({ view: 'bills' })
  })

  it('writes the tab as undefined when it is no tab', () => {
    expect(parseBudgetSearch({ view: 'overview' })).toEqual({ view: undefined })
    expect(parseBudgetSearch({ view: 1 })).toEqual({ view: undefined })
    expect(parseBudgetSearch({})).toEqual({ view: undefined })
  })
})
