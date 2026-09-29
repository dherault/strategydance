import { describe, expect, it } from 'bun:test'

import getChecklistGrid from '~utils/buildInPublic/getChecklistGrid'

const items = [
  { id: 'reflexion', name: 'Reflexion' },
  { id: 'users', name: 'Talk to users' },
]

describe('getChecklistGrid', () => {
  it('lays the days out oldest first, today last', () => {
    const { rows } = getChecklistGrid(items, new Map(), '2026-09-29', 3)

    expect(rows.map(row => row.date)).toEqual(['2026-09-27', '2026-09-28', '2026-09-29'])
    expect(rows.map(row => row.isToday)).toEqual([false, false, true])
  })

  it('counts each item, and its run through a today not ticked yet', () => {
    const ticks = new Map([
      ['reflexion', new Set(['2026-09-26', '2026-09-27', '2026-09-28'])],
      ['users', new Set(['2026-09-26', '2026-09-29'])],
    ])
    const { perItem, best, latest, weekDoneCount } = getChecklistGrid(items, ticks, '2026-09-29', 4)

    expect(perItem.map(item => [item.doneCount, item.streak])).toEqual([
      [3, 3],
      [2, 1],
    ])
    expect(best?.id).toBe('reflexion')
    expect(latest.date).toBe('2026-09-29')
    expect(weekDoneCount).toBe(5)
  })

  it('counts a run past the days it lays out', () => {
    const dates = Array.from({ length: 10 }, (_, index) => `2026-09-${String(20 + index - 1).padStart(2, '0')}`)
    const { perItem } = getChecklistGrid(items, new Map([['reflexion', new Set(dates)]]), '2026-09-29', 3)

    expect(perItem[0].doneCount).toBe(2)
    expect(perItem[0].streak).toBe(10)
  })

  it('reads the latest day as the last one when nothing is ticked', () => {
    const { latest, best } = getChecklistGrid(items, new Map(), '2026-09-29', 2)

    expect(latest.date).toBe('2026-09-29')
    expect(best?.streak).toBe(0)
  })
})
