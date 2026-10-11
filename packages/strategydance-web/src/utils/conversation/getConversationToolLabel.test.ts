import { describe, expect, it } from 'bun:test'

import { createIntl } from 'react-intl'

import getConversationToolLabel from '~utils/conversation/getConversationToolLabel'

const intl = createIntl({ locale: 'en', messages: {} })

describe('getConversationToolLabel', () => {
  it('says what each of the agent’s tools does, then what it did', () => {
    const tools = [
      ['web_search', 'Searching the web', 'Searched the web'],
      ['search_documents', 'Searching knowledge', 'Searched knowledge'],
      ['list_documents', 'Listing knowledge', 'Listed knowledge'],
      ['read_document', 'Opening knowledge', 'Opened knowledge'],
      ['create_document', 'Creating knowledge', 'Created knowledge'],
      ['update_document', 'Updating knowledge', 'Updated knowledge'],
      ['set_document_aspects', 'Tagging knowledge', 'Tagged knowledge'],
      ['delete_document', 'Deleting knowledge', 'Deleted knowledge'],
      ['restore_document', 'Restoring knowledge', 'Restored knowledge'],
    ] as const

    for (const [toolName, running, done] of tools) {
      expect(getConversationToolLabel(intl, toolName, 'RUNNING')).toBe(running)
      expect(getConversationToolLabel(intl, toolName, 'SUCCEEDED')).toBe(done)
    }
  })

  it('says what a failed or cancelled call tried', () => {
    expect(getConversationToolLabel(intl, 'update_document', 'FAILED')).toBe('Updating knowledge')
    expect(getConversationToolLabel(intl, 'update_document', 'CANCELLED')).toBe('Updating knowledge')
  })

  it('names a tool it has no words for by its name, a key of an object included', () => {
    expect(getConversationToolLabel(intl, 'call_integration_tool', 'SUCCEEDED')).toBe('call_integration_tool')
    expect(getConversationToolLabel(intl, 'constructor', 'SUCCEEDED')).toBe('constructor')
  })
})
