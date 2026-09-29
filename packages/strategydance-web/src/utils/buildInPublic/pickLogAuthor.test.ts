import { describe, expect, it } from 'bun:test'

import pickLogAuthor from '~utils/buildInPublic/pickLogAuthor'

describe('pickLogAuthor', () => {
  it('keeps the author picked while they have written', () => {
    expect(pickLogAuthor('priya', ['alex', 'priya'], 'alex')).toBe('priya')
  })

  it('falls back to the reader, then to the first author', () => {
    expect(pickLogAuthor('gone', ['alex', 'priya'], 'alex')).toBe('alex')
    expect(pickLogAuthor('gone', ['priya', 'sam'], 'alex')).toBe('priya')
  })

  it('picks nobody from nobody', () => {
    expect(pickLogAuthor('alex', [], 'alex')).toBeNull()
  })
})
