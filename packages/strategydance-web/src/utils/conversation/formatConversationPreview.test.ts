import { describe, expect, it } from 'bun:test'

import { createIntl } from 'react-intl'
import { buildConversationPreview } from 'strategydance-core'

import formatConversationPreview from '~utils/conversation/formatConversationPreview'

// English from each message's own words, as a reader with no catalogue loaded sees them
const intl = createIntl({ locale: 'en', messages: {} })

// The time the tests read previews at
const NOW = Date.parse('2026-10-19T12:00:00.000Z')

function format(preview: unknown, activeRunId: string | null = null) {
  return formatConversationPreview(intl, { activeRunId, preview }, NOW)
}

describe('formatConversationPreview', () => {
  it('says the agent is thinking while a run goes, whatever came last', () => {
    expect(format({ kind: 'AGENT_TEXT', text: 'Done.' }, 'run')).toBe('Thinking…')
    expect(format(null, 'run')).toBe('Thinking…')
  })

  it('names a call to an integration by its server, and an approval by its server and tool', () => {
    const approval = (
      approvalState: 'PENDING' | 'ALLOWED' | 'DENIED',
      toolStatus: 'SUCCEEDED' | 'FAILED' | null = null,
    ) =>
      format(
        buildConversationPreview({
          kind: 'APPROVAL',
          integrationName: 'Stripe',
          integrationToolName: 'create_payment_link',
          approvalState,
          toolStatus,
        }),
      )

    expect(
      format(
        buildConversationPreview({
          kind: 'TOOL_CALL',
          toolName: 'call_integration_tool',
          toolStatus: 'SUCCEEDED',
          integrationName: 'Stripe',
        }),
      ),
    ).toBe('Called Stripe')
    expect(approval('PENDING')).toBe('Approval: Stripe · create_payment_link')
    expect(approval('ALLOWED')).toBe('Allowed: Stripe · create_payment_link')
    expect(approval('ALLOWED', 'SUCCEEDED')).toBe('Called Stripe')
    expect(approval('ALLOWED', 'FAILED')).toBe('Calling Stripe · Failed')
    expect(approval('DENIED', 'FAILED')).toBe('Denied: Stripe · create_payment_link')
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

  it("names the files of a member's message holding no words, and keeps the words of one that does", () => {
    const files = (...names: string[]) => names.map(name => ({ name }))

    expect(
      format(
        buildConversationPreview({
          kind: 'MEMBER_TEXT',
          text: '',
          conversationAttachments_on_message: files('plan.pdf'),
        }),
      ),
    ).toBe('You: plan.pdf')
    expect(
      format(
        buildConversationPreview({
          kind: 'MEMBER_TEXT',
          text: '',
          conversationAttachments_on_message: files('plan.pdf', 'notes.md', 'deck.pdf'),
        }),
      ),
    ).toBe('You: 3 files')
    expect(
      format(
        buildConversationPreview({
          kind: 'MEMBER_TEXT',
          text: 'What do you make of these?',
          conversationAttachments_on_message: files('plan.pdf', 'notes.md'),
        }),
      ),
    ).toBe('You: What do you make of these?')
  })

  it('names a tool by what it does, then by what it did', () => {
    expect(format({ kind: 'TOOL_CALL', toolName: 'search_documents', toolStatus: 'RUNNING' })).toBe(
      'Searching knowledge',
    )
    expect(format({ kind: 'TOOL_CALL', toolName: 'search_documents', toolStatus: 'SUCCEEDED' })).toBe(
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
    expect(format({ kind: 'TOOL_CALL', toolName: 'send_invoice', toolStatus: 'SUCCEEDED' })).toBe('send_invoice')
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

  it('says which daily spend ceiling stopped a failed note’s run, and when it has room', () => {
    const ceiling = (scope: string, freesAt: string) =>
      format({ kind: 'NOTE', noteKind: 'FAILED', ceiling: { scope, freesAt } })

    expect(ceiling('MEMBER', '2026-10-19T15:00:00.000Z')).toBe(
      'This response stopped: your conversations in this organization cost as much as the $25 they may in 24 hours. It can go on in 3 hours.',
    )
    expect(ceiling('ORGANIZATION', '2026-10-19T12:20:00.000Z')).toBe(
      "This response stopped: your team's conversations in this organization cost as much as the $150 they may in 24 hours. It can go on in 20 minutes.",
    )
    expect(ceiling('ACCOUNT', '2026-10-19T11:00:00.000Z')).toBe(
      'This response stopped at a daily spending limit, which has room again.',
    )
  })

  it('shows no line for a preview it cannot read', () => {
    expect(format({ kind: 'ATTACHMENTS', count: 3 })).toBe('')
    expect(format({ kind: 'TOOL_CALL', toolName: 'web_search', toolStatus: 'PAUSED' })).toBe('')
    expect(format('A preview')).toBe('')
  })
})
