import { describe, expect, it } from 'bun:test'

import cutToFit from '~utils/cutToFit'

describe('cutToFit', () => {
  it('keeps a text JSON writes within the budget whole', () => {
    expect(cutToFit('Listed on 2026-11-02', 100)).toBe('Listed on 2026-11-02')
  })

  it('counts what JSON escapes, a quote taking two characters', () => {
    expect(cutToFit('a"b', 3)).toBe('a"')
    expect(cutToFit('a"b', 2)).toBe('a')
  })

  it('cuts between two characters, never inside one', () => {
    expect(cutToFit('ab😀c', 3)).toBe('ab')
    expect(cutToFit('ab😀c', 4)).toBe('ab😀')
  })

  it('answers an empty string when nothing fits', () => {
    expect(cutToFit('text', 0)).toBe('')
  })
})
