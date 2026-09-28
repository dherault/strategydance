import { describe, expect, it } from 'bun:test'

import getPriorityColumnCount from '~utils/today/getPriorityColumnCount'

describe('getPriorityColumnCount', () => {
  it('favors square shapes, up to three columns', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 12].map(getPriorityColumnCount)).toEqual([1, 1, 2, 3, 2, 3, 3, 3])
  })
})
