import { describe, expect, it } from 'bun:test'

import isTaskDropInPlace from '~utils/task/isTaskDropInPlace'

const SHOWN = ['a', 'b', 'c']

describe('isTaskDropInPlace', () => {
  it('leaves a card dropped before itself or before the card after it', () => {
    expect(isTaskDropInPlace(SHOWN, 'b', 'b')).toBe(true)
    expect(isTaskDropInPlace(SHOWN, 'b', 'c')).toBe(true)
  })

  it('leaves the last card dropped past the end', () => {
    expect(isTaskDropInPlace(SHOWN, 'c', null)).toBe(true)
  })

  it('moves a card dropped anywhere else in its column', () => {
    expect(isTaskDropInPlace(SHOWN, 'b', 'a')).toBe(false)
    expect(isTaskDropInPlace(SHOWN, 'a', 'c')).toBe(false)
    expect(isTaskDropInPlace(SHOWN, 'a', null)).toBe(false)
  })

  it('moves a card the column does not show', () => {
    expect(isTaskDropInPlace(SHOWN, 'd', 'a')).toBe(false)
    expect(isTaskDropInPlace(SHOWN, 'd', null)).toBe(false)
    expect(isTaskDropInPlace([], 'd', null)).toBe(false)
  })
})
