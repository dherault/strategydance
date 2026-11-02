import { describe, expect, it } from 'bun:test'

import { createIntl } from 'react-intl'

import getConversationToolLabel from '~utils/conversation/getConversationToolLabel'

const intl = createIntl({ locale: 'en', messages: {} })

describe('getConversationToolLabel', () => {
  it('says what each of the agent’s tools does, then what it did', () => {
    const tools = [
      ['web_search', 'Searching the web', 'Searched the web'],
      ['search_documents', 'Searching documents', 'Searched documents'],
      ['list_documents', 'Listing documents', 'Listed documents'],
      ['read_document', 'Opening a document', 'Opened a document'],
      ['create_document', 'Creating a document', 'Created a document'],
      ['update_document', 'Updating a document', 'Updated a document'],
      ['set_document_aspects', 'Tagging a document', 'Tagged a document'],
      ['delete_document', 'Deleting a document', 'Deleted a document'],
      ['restore_document', 'Restoring a document', 'Restored a document'],
      ['list_tasks', 'Listing tasks', 'Listed tasks'],
      ['read_task', 'Opening a task', 'Opened a task'],
      ['create_task', 'Creating a task', 'Created a task'],
      ['update_task', 'Updating a task', 'Updated a task'],
      ['add_task_dependency', 'Linking tasks', 'Linked tasks'],
      ['remove_task_dependency', 'Unlinking tasks', 'Unlinked tasks'],
      ['delete_task', 'Deleting a task', 'Deleted a task'],
      ['restore_task', 'Restoring a task', 'Restored a task'],
      ['read_budget', 'Checking the budget', 'Checked the budget'],
      ['list_bills', 'Listing bills', 'Listed bills'],
      ['read_bill', 'Opening a bill', 'Opened a bill'],
      ['add_bill', 'Adding a bill', 'Added a bill'],
      ['update_bill', 'Updating a bill', 'Updated a bill'],
      ['delete_bill', 'Deleting a bill', 'Deleted a bill'],
      ['restore_bill', 'Restoring a bill', 'Restored a bill'],
      ['list_integrations', 'Listing integrations', 'Listed integrations'],
      ['describe_integration_tool', 'Reading an integration’s tool', 'Read an integration’s tool'],
      ['call_integration_tool', 'Calling an integration', 'Called an integration'],
      ['list_subagents', 'Listing subagents', 'Listed subagents'],
      ['read_subagent', 'Reading a subagent’s work', 'Read a subagent’s work'],
      ['launch_subagent', 'Launching a subagent', 'Launched a subagent'],
      ['stop_subagent', 'Stopping a subagent', 'Stopped a subagent'],
      ['list_knowledge', 'Browsing the knowledge', 'Browsed the knowledge'],
      ['read_knowledge', 'Reading the knowledge', 'Read the knowledge'],
      ['set_knowledge_in_use', 'Marking what the company uses', 'Marked what the company uses'],
      ['link_knowledge', 'Linking knowledge', 'Linked knowledge'],
      ['unlink_knowledge', 'Unlinking knowledge', 'Unlinked knowledge'],
    ] as const

    for (const [toolName, running, done] of tools) {
      expect(getConversationToolLabel(intl, toolName, 'RUNNING')).toBe(running)
      expect(getConversationToolLabel(intl, toolName, 'SUCCEEDED')).toBe(done)
    }
  })

  it('says what a failed or cancelled call tried', () => {
    expect(getConversationToolLabel(intl, 'update_document', 'FAILED')).toBe('Updating a document')
    expect(getConversationToolLabel(intl, 'update_document', 'CANCELLED')).toBe('Updating a document')
  })

  it('names a tool it has no words for by its name, a key of an object included', () => {
    expect(getConversationToolLabel(intl, 'send_invoice', 'SUCCEEDED')).toBe('send_invoice')
    expect(getConversationToolLabel(intl, 'constructor', 'SUCCEEDED')).toBe('constructor')
  })

  it('names a call to an integration by its server', () => {
    expect(getConversationToolLabel(intl, 'call_integration_tool', 'RUNNING', 'Stripe')).toBe('Calling Stripe')
    expect(getConversationToolLabel(intl, 'call_integration_tool', 'SUCCEEDED', 'Stripe')).toBe('Called Stripe')
  })
})
