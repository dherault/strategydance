import { describe, expect, it } from 'bun:test'

import type { ConversationPreview } from 'strategydance-core'

import parseConversationPreview from '~utils/conversation/parseConversationPreview'

describe('parseConversationPreview', () => {
  it('reads each kind back as it was written', () => {
    const previews: ConversationPreview[] = [
      { kind: 'MEMBER_TEXT', text: 'Hi' },
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
