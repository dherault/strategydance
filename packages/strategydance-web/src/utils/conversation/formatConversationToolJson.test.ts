import { describe, expect, it } from 'bun:test'

import formatConversationToolJson from '~utils/conversation/formatConversationToolJson'

describe('formatConversationToolJson', () => {
  it('lays JSON out as JSON.stringify does, two spaces deep', () => {
    const value = {
      query: 'pricing, "quoted" {braces} [brackets]: and \\ a backslash',
      limit: 5,
      nested: { list: [1, { deep: true }, null], empty: {}, none: [] },
      flag: false,
    }

    expect(formatConversationToolJson(JSON.stringify(value))).toBe(JSON.stringify(value, null, 2))
  })

  it('lays out text that is laid out already the same way', () => {
    const value = { a: [1, 2], b: { c: 'd' } }

    expect(formatConversationToolJson(JSON.stringify(value, null, 4))).toBe(JSON.stringify(value, null, 2))
  })

  it('keeps every value exactly as stored, where parsing would change it', () => {
    expect(formatConversationToolJson('{"id":9007199254740993,"huge":1e400,"zero":-0.0}')).toBe(
      '{\n  "id": 9007199254740993,\n  "huge": 1e400,\n  "zero": -0.0\n}',
    )
  })

  it('keeps a key written twice, and the order the keys were stored in', () => {
    expect(formatConversationToolJson('{"b":1,"a":2,"b":3}')).toBe('{\n  "b": 1,\n  "a": 2,\n  "b": 3\n}')
  })

  it('shows U+0000 escaped in a nested key and in a value', () => {
    const shown = formatConversationToolJson(JSON.stringify({ account: { 'acct\u0000admin': 'pay\u0000out' } }))

    expect(shown).toContain('"acct\\u0000admin": "pay\\u0000out"')
    expect(shown).not.toContain('\u0000')
  })

  it('escapes DEL, the C1 controls, the line separators and the marks that reorder text', () => {
    const value = { name: 'a\u007fb\u0085c d‮e' }
    const shown = formatConversationToolJson(JSON.stringify(value))

    expect(shown).toBe('{\n  "name": "a\\u007fb\\u0085c\\u2028d\\u202ee"\n}')
    expect(JSON.parse(shown)).toEqual(value)
  })

  it('shows text that is not JSON as it is, its controls escaped and its lines kept', () => {
    expect(formatConversationToolJson('line one\nline\u0000two')).toBe('line one\nline\\u0000two')
  })

  it('shows nothing for a call with no output yet', () => {
    expect(formatConversationToolJson(null)).toBe('')
  })
})
