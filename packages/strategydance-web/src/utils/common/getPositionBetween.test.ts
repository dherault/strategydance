import { describe, expect, it } from 'bun:test'

import getPositionBetween from '~utils/common/getPositionBetween'

describe('getPositionBetween', () => {
  it('starts an empty list at one', () => {
    expect(getPositionBetween(null, null)).toBe(1)
  })

  it('goes one past the last, or one before the first', () => {
    expect(getPositionBetween(3, null)).toBe(4)
    expect(getPositionBetween(null, 3)).toBe(2)
  })

  it('goes halfway between two', () => {
    expect(getPositionBetween(1, 2)).toBe(1.5)
  })

  it('answers null once no float fits between two', () => {
    let after = 2
    let position: number | null = 1

    for (let move = 0; move < 100 && position !== null; move++) {
      after = position
      position = getPositionBetween(1, after)
    }

    expect(position).toBeNull()
  })
})
