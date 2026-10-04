import { describe, expect, it } from 'bun:test'

import { createIntl } from 'react-intl'

import getConversationToolLabel from '~utils/conversation/getConversationToolLabel'

const intl = createIntl({ locale: 'en', messages: {} })

describe('getConversationToolLabel', () => {
  it('says what each of the agent’s tools does, then what it did', () => {
    const tools = [
      ['web_search', 'Searching the web', 'Searched the web'],
      ['search_knowledge', 'Searching knowledge', 'Searched knowledge'],
      ['read_knowledge', 'Opening knowledge', 'Opened knowledge'],
      ['create_knowledge', 'Creating knowledge', 'Created knowledge'],
      ['update_knowledge', 'Updating knowledge', 'Updated knowledge'],
      ['get_team', 'Reading your team', 'Read your team'],
      ['read_log', 'Reading the log', 'Read the log'],
      ['set_top_priority', 'Setting your top priority', 'Set your top priority'],
    ] as const

    for (const [toolName, running, done] of tools) {
      expect(getConversationToolLabel(intl, toolName, 'RUNNING')).toBe(running)
      expect(getConversationToolLabel(intl, toolName, 'SUCCEEDED')).toBe(done)
    }
  })

  it('says what a failed or cancelled call tried', () => {
    expect(getConversationToolLabel(intl, 'read_log', 'FAILED')).toBe('Reading the log')
    expect(getConversationToolLabel(intl, 'read_log', 'CANCELLED')).toBe('Reading the log')
  })

  it('names a tool it has no words for by its name, a key of an object included', () => {
    expect(getConversationToolLabel(intl, 'call_integration_tool', 'SUCCEEDED')).toBe('call_integration_tool')
    expect(getConversationToolLabel(intl, 'constructor', 'SUCCEEDED')).toBe('constructor')
  })
})
