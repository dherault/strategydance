import { describe, expect, it } from 'bun:test'

import { createIntl } from 'react-intl'
import { buildConversationPreview } from 'strategydance-core'

import formatConversationPreview from '~utils/conversation/formatConversationPreview'

// English from each message's own words, as a reader with no catalogue loaded sees them
const intl = createIntl({ locale: 'en', messages: {} })

function format(preview: unknown, activeRunId: string | null = null) {
  return formatConversationPreview(intl, { activeRunId, preview })
}

describe('formatConversationPreview', () => {
  it('says the agent is thinking while a run goes, whatever came last', () => {
    expect(format({ kind: 'AGENT_TEXT', text: 'Done.' }, 'run')).toBe('Thinking…')
    expect(format(null, 'run')).toBe('Thinking…')
  })

  it('says a conversation without a preview holds nothing yet', () => {
    expect(format(null)).toBe('No messages yet')
    expect(format(undefined)).toBe('No messages yet')
  })

  it("marks the member's own message, and leaves the agent's as it is", () => {
    expect(format(buildConversationPreview({ kind: 'MEMBER_TEXT', text: 'Draft the **update**.' }))).toBe(
      'You: Draft the update.',
    )
    expect(format(buildConversationPreview({ kind: 'AGENT_TEXT', text: '- One\n- Two' }))).toBe('One, Two')
  })

  it('names a tool by what it does, then by what it did', () => {
    expect(format({ kind: 'TOOL_CALL', toolName: 'search_knowledge', toolStatus: 'RUNNING' })).toBe(
      'Searching knowledge',
    )
    expect(format({ kind: 'TOOL_CALL', toolName: 'search_knowledge', toolStatus: 'SUCCEEDED' })).toBe(
      'Searched knowledge',
    )
  })

  it('says a tool failed or was cancelled after what it tried', () => {
    expect(format({ kind: 'TOOL_CALL', toolName: 'web_search', toolStatus: 'FAILED' })).toBe(
      'Searching the web · Failed',
    )
    expect(format({ kind: 'TOOL_CALL', toolName: 'web_search', toolStatus: 'CANCELLED' })).toBe(
      'Searching the web · Cancelled',
    )
  })

  it('names a tool it has no words for by its name', () => {
    expect(format({ kind: 'TOOL_CALL', toolName: 'call_integration_tool', toolStatus: 'SUCCEEDED' })).toBe(
      'call_integration_tool',
    )
  })

  it('words a question waiting, skipped and answered', () => {
    const question = { kind: 'QUESTION', questionPrompt: 'Which model?' } as const

    expect(format(buildConversationPreview(question))).toBe('Question: Which model?')
    expect(format(buildConversationPreview({ ...question, isAnswerSkipped: true }))).toBe('Skipped: Which model?')
    expect(
      format(buildConversationPreview({ ...question, answerSelected: ['X', 'Product Hunt'], answerOther: 'Slack' })),
    ).toBe('Answered: X, Product Hunt, Slack')
  })

  it('says how a run ended for each kind of note', () => {
    expect(format({ kind: 'NOTE', noteKind: 'STOPPED' })).toBe('You stopped this response.')
    expect(format({ kind: 'NOTE', noteKind: 'FAILED' })).toBe('Something went wrong, and this response stopped.')
    expect(format({ kind: 'NOTE', noteKind: 'REFUSED' })).toBe('Strategy Dance could not answer this.')
    expect(format({ kind: 'NOTE', noteKind: 'INTERRUPTED' })).toBe('This response was interrupted.')
    expect(format({ kind: 'NOTE', noteKind: 'FULL' })).toBe('This conversation is full. Start a new one to go on.')
  })

  it('shows no line for a preview it cannot read', () => {
    expect(format({ kind: 'ATTACHMENTS', count: 3 })).toBe('')
    expect(format({ kind: 'TOOL_CALL', toolName: 'web_search', toolStatus: 'PAUSED' })).toBe('')
    expect(format('A preview')).toBe('')
  })
})
