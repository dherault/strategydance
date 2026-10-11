import { describe, expect, test } from 'bun:test'

import sanitizeOAuthClientName from './sanitizeOAuthClientName'

describe('sanitizeOAuthClientName', () => {
  test('keeps a name as it is', () => {
    expect(sanitizeOAuthClientName('Claude Code')).toBe('Claude Code')
    expect(sanitizeOAuthClientName('Cursor 日本語')).toBe('Cursor 日本語')
  })

  test('strips control and direction characters and collapses spaces', () => {
    expect(sanitizeOAuthClientName('Good‮evil')).toBe('Goodevil')
    expect(sanitizeOAuthClientName('Two\nlines here')).toBe('Two lines here')
    expect(sanitizeOAuthClientName('  spaced \t out  ')).toBe('spaced out')
    expect(sanitizeOAuthClientName('zero​width')).toBe('zerowidth')
  })

  test('cuts to 80 characters, counting what a reader sees', () => {
    expect(sanitizeOAuthClientName('a'.repeat(100))).toBe('a'.repeat(80))
    expect(Array.from(sanitizeOAuthClientName('😀'.repeat(100)) ?? '')).toHaveLength(80)
  })

  test('answers null for no name', () => {
    for (const name of [undefined, null, 42, '', '   ', '‮​']) {
      expect(sanitizeOAuthClientName(name)).toBeNull()
    }
  })
})
