import { describe, expect, it } from 'bun:test'

import formatConversationToolJson from '~utils/conversation/formatConversationToolJson'

describe('formatConversationToolJson', () => {
  it('lays JSON out over lines, indented two spaces', () => {
    expect(formatConversationToolJson('{"query":"pricing","limit":5}')).toBe(
      '{\n  "query": "pricing",\n  "limit": 5\n}',
    )
  })

  it('keeps the keys in the order they were stored', () => {
    expect(formatConversationToolJson('{"b":1,"a":2}')).toBe('{\n  "b": 1,\n  "a": 2\n}')
  })

  it('escapes U+0000 in a nested key and in a value', () => {
    const shown = formatConversationToolJson(JSON.stringify({ account: { 'acct\u0000admin': 'pay\u0000out' } }))

    expect(shown).toContain('"acct\\u0000admin": "pay\\u0000out"')
    expect(shown).not.toContain('\u0000')
  })

  it('escapes DEL, the C1 controls and the marks that reorder text', () => {
    const shown = formatConversationToolJson(JSON.stringify({ name: 'a\u007fb\u0085c‮d' }))

    expect(shown).toBe('{\n  "name": "a\\u007fb\\u0085c\\u202ed"\n}')
    expect(JSON.parse(shown)).toEqual({ name: 'a\u007fb\u0085c‮d' })
  })

  it('shows text that is not JSON as it is, its controls escaped and its lines kept', () => {
    expect(formatConversationToolJson('line one\nline\u0000two')).toBe('line one\nline\\u0000two')
  })

  it('shows nothing for a call with no output yet', () => {
    expect(formatConversationToolJson(null)).toBe('')
  })
})
