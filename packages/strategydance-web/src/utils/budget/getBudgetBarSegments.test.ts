import { describe, expect, it } from 'bun:test'

import getBudgetBarSegments from '~utils/budget/getBudgetBarSegments'

describe('getBudgetBarSegments', () => {
  it('draws spent and expected under the limit', () => {
    expect(getBudgetBarSegments(40, 20, 100)).toEqual({
      segments: [
        { kind: 'spent', left: 0, width: 40 },
        { kind: 'expected', left: 40, width: 20 },
      ],
      limitAt: null,
      percent: 40,
      percentWithExpected: 60,
    })
  })

  it('draws expected past the limit, with the mark where it ends', () => {
    const { segments, limitAt, percentWithExpected } = getBudgetBarSegments(80, 120, 100)

    expect(segments.map(({ kind }) => kind)).toEqual(['spent', 'expected', 'expectedOver'])
    expect(segments[2]).toEqual({ kind: 'expectedOver', left: 50, width: 50 })
    expect(limitAt).toBe(50)
    expect(percentWithExpected).toBe(200)
  })

  it('draws what was spent past the limit in its own segment', () => {
    const { segments, limitAt } = getBudgetBarSegments(125, 0, 100)

    expect(segments).toEqual([
      { kind: 'spent', left: 0, width: 80 },
      { kind: 'over', left: 80, width: 20 },
    ])
    expect(limitAt).toBe(80)
  })

  it('names no expected share without expected bills', () => {
    expect(getBudgetBarSegments(50, null, 100).percentWithExpected).toBeNull()
    expect(getBudgetBarSegments(50, 0, 100).percentWithExpected).toBeNull()
  })

  it('draws an empty bar at 0', () => {
    expect(getBudgetBarSegments(0, 0, 100)).toMatchObject({ segments: [], limitAt: null, percent: 0 })
  })
})
