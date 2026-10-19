import { describe, expect, it } from 'bun:test'

import { ConversationMessageKind } from 'strategydance-database/web'

import hasConversationMessageBody from '~utils/conversation/hasConversationMessageBody'

describe('hasConversationMessageBody', () => {
  it('reads the words of a text, a question, an approval and a brief apart', () => {
    for (const kind of [
      ConversationMessageKind.MEMBER_TEXT,
      ConversationMessageKind.AGENT_TEXT,
      ConversationMessageKind.QUESTION,
      ConversationMessageKind.APPROVAL,
      ConversationMessageKind.BRIEF,
    ]) {
      expect(hasConversationMessageBody({ kind })).toBe(true)
    }
  })

  it('draws a note, an aspects note and most calls from their entry alone', () => {
    expect(hasConversationMessageBody({ kind: ConversationMessageKind.NOTE })).toBe(false)
    expect(hasConversationMessageBody({ kind: ConversationMessageKind.ASPECTS })).toBe(false)
    expect(hasConversationMessageBody({ kind: ConversationMessageKind.TOOL_CALL, toolName: 'web_search' })).toBe(false)
  })

  it('reads the body of a call to an integration, whose server and tool it names', () => {
    expect(
      hasConversationMessageBody({ kind: ConversationMessageKind.TOOL_CALL, toolName: 'call_integration_tool' }),
    ).toBe(true)
  })

  it('reads the body of a launch, whose call’s id finds the subagent it launched', () => {
    expect(hasConversationMessageBody({ kind: ConversationMessageKind.TOOL_CALL, toolName: 'launch_subagent' })).toBe(
      true,
    )
  })

  it('reads the body of an edit of a document, whose call’s id finds the revision an Undo goes back to', () => {
    expect(hasConversationMessageBody({ kind: ConversationMessageKind.TOOL_CALL, toolName: 'update_document' })).toBe(
      true,
    )
  })
})
