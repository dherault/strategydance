import { describe, expect, it } from 'bun:test'

import { createIntl } from 'react-intl'

import getConversationNoteText from '~utils/conversation/getConversationNoteText'

const intl = createIntl({ locale: 'en', messages: {} })

describe('getConversationNoteText', () => {
  it('says how a conversation’s response ended', () => {
    expect(getConversationNoteText(intl, 'STOPPED')).toBe('You stopped this response.')
    expect(getConversationNoteText(intl, 'FULL')).toBe('This conversation is full. Start a new one to go on.')
  })

  it('says how a subagent’s work ended, which its parent may have stopped', () => {
    expect(getConversationNoteText(intl, 'STOPPED', 'subagent')).toBe('This subagent was stopped.')
    expect(getConversationNoteText(intl, 'INTERRUPTED', 'subagent')).toBe('This subagent was interrupted.')
    expect(getConversationNoteText(intl, 'FAILED', 'subagent')).toBe('Something went wrong, and this subagent stopped.')
  })
})
