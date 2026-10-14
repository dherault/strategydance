import { describe, expect, it } from 'bun:test'

import type { ConversationPreview } from 'strategydance-core'

import parseConversationPreview from '~utils/conversation/parseConversationPreview'

describe('parseConversationPreview', () => {
  it('reads each kind back as it was written', () => {
    const previews: ConversationPreview[] = [
      { kind: 'MEMBER_TEXT', text: 'Hi' },
      { kind: 'MEMBER_TEXT', text: '', attachmentCount: 2, attachmentName: 'plan.pdf' },
      { kind: 'AGENT_TEXT', text: 'Hello' },
      { kind: 'TOOL_CALL', toolName: 'read_log', toolStatus: 'FAILED' },
      { kind: 'QUESTION', questionState: 'ANSWERED', text: 'X, Y' },
      { kind: 'NOTE', noteKind: 'FULL' },
    ]

    for (const preview of previews) expect(parseConversationPreview(preview)).toEqual(preview)
  })

  it('keeps only the fields of its kind', () => {
    expect(parseConversationPreview({ kind: 'NOTE', noteKind: 'STOPPED', text: 'Extra' })).toEqual({
      kind: 'NOTE',
      noteKind: 'STOPPED',
    })
  })

  it("reads a member's message without the files it cannot read", () => {
    expect(
      parseConversationPreview({ kind: 'MEMBER_TEXT', text: 'Hi', attachmentCount: 0, attachmentName: 'a' }),
    ).toEqual({ kind: 'MEMBER_TEXT', text: 'Hi' })
    expect(
      parseConversationPreview({ kind: 'MEMBER_TEXT', text: '', attachmentCount: '2', attachmentName: 'a' }),
    ).toEqual({ kind: 'MEMBER_TEXT', text: '' })
    expect(parseConversationPreview({ kind: 'MEMBER_TEXT', text: '', attachmentCount: 1 })).toEqual({
      kind: 'MEMBER_TEXT',
      text: '',
    })
  })

  it('reads the server of a call to an integration, and an approval', () => {
    expect(
      parseConversationPreview({
        kind: 'TOOL_CALL',
        toolName: 'call_integration_tool',
        toolStatus: 'SUCCEEDED',
        integrationName: 'Stripe',
      }),
    ).toEqual({
      kind: 'TOOL_CALL',
      toolName: 'call_integration_tool',
      toolStatus: 'SUCCEEDED',
      integrationName: 'Stripe',
    })
    expect(
      parseConversationPreview({
        kind: 'APPROVAL',
        integrationName: 'Stripe',
        integrationToolName: 'create_payment_link',
        approvalState: 'PENDING',
        toolStatus: null,
      }),
    ).toEqual({
      kind: 'APPROVAL',
      integrationName: 'Stripe',
      integrationToolName: 'create_payment_link',
      approvalState: 'PENDING',
      toolStatus: null,
    })
    expect(
      parseConversationPreview({
        kind: 'APPROVAL',
        integrationName: 'Stripe',
        integrationToolName: 'x',
        approvalState: 'LATER',
      }),
    ).toBeNull()
  })

  it('reads nothing that has not its shape', () => {
    expect(parseConversationPreview(null)).toBeNull()
    expect(parseConversationPreview('AGENT_TEXT')).toBeNull()
    expect(parseConversationPreview({ kind: 'AGENT_TEXT' })).toBeNull()
    expect(parseConversationPreview({ kind: 'TOOL_CALL', toolName: 'read_log' })).toBeNull()
    expect(parseConversationPreview({ kind: 'QUESTION', questionState: 'LATER', text: 'Why?' })).toBeNull()
    expect(parseConversationPreview({ kind: 'NOTE', noteKind: 'PAUSED' })).toBeNull()
    expect(parseConversationPreview({ kind: 'ATTACHMENTS', count: 2 })).toBeNull()
  })
})
