import { describe, expect, it } from 'bun:test'

import escapeConversationLinkLabel from '~utils/conversation/escapeConversationLinkLabel'

describe('escapeConversationLinkLabel', () => {
  it('escapes brackets and backslashes', () => {
    expect(escapeConversationLinkLabel('Q3 [draft] \\ notes')).toBe('Q3 \\[draft\\] \\\\ notes')
  })

  it('leaves every other character as it is', () => {
    expect(escapeConversationLinkLabel('(Plan) *B* _v2_ `x` @ Acme')).toBe('(Plan) *B* _v2_ `x` @ Acme')
  })
})
