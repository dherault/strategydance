import { describe, expect, it } from 'bun:test'

import type { ConversationThreadEntry } from '~types'

import needsConversationBills from '~utils/conversation/needsConversationBills'

function entry(id: string, kind: string, toolName: string | null = null) {
  return { id, kind, toolName } as unknown as ConversationThreadEntry
}

describe('needsConversationBills', () => {
  it('needs the bills for a row that deleted a bill', () => {
    expect(needsConversationBills([entry('a', 'AGENT_TEXT'), entry('b', 'TOOL_CALL', 'delete_bill')])).toBe(true)
  })

  it('needs none for a thread that deleted no bill, whatever else its rows did', () => {
    expect(
      needsConversationBills([
        entry('a', 'MEMBER_TEXT'),
        entry('b', 'TOOL_CALL', 'add_bill'),
        entry('c', 'TOOL_CALL', 'restore_bill'),
        entry('d', 'TOOL_CALL', 'delete_task'),
        entry('e', 'AGENT_TEXT', 'delete_bill'),
      ]),
    ).toBe(false)
  })
})
