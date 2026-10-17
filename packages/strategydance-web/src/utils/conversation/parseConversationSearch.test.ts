import { describe, expect, it } from 'bun:test'

import parseConversationSearch from '~utils/conversation/parseConversationSearch'

describe('parseConversationSearch', () => {
  it('reads a draft, and nothing else for one', () => {
    expect(parseConversationSearch({ isNew: true })).toEqual({ isNew: true, subagent: undefined })
    expect(parseConversationSearch({ isNew: 'true' })).toEqual({ isNew: undefined, subagent: undefined })
  })

  it('reads the subagent whose work is open, hyphenated or as Data Connect writes it', () => {
    expect(parseConversationSearch({ subagent: '9f8e7d6c-5b4a-4321-9f8e-7d6c5b4a4321' }).subagent).toBe(
      '9f8e7d6c-5b4a-4321-9f8e-7d6c5b4a4321',
    )
    expect(parseConversationSearch({ subagent: '9f8e7d6c5b4a43219f8e7d6c5b4a4321' }).subagent).toBe(
      '9f8e7d6c5b4a43219f8e7d6c5b4a4321',
    )
  })

  it('overwrites anything else under its key, a number the query parsed from digits included', () => {
    for (const subagent of [Number('12345678901234567890123456789012'), 'research', '9f8e7d6c-5b4a', null, ['a']]) {
      expect(parseConversationSearch({ subagent })).toEqual({ isNew: undefined, subagent: undefined })
    }
  })
})
