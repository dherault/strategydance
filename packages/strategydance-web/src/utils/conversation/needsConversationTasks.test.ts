import { describe, expect, it } from 'bun:test'

import type { ConversationMessageBody, ConversationThreadEntry } from '~types'

import needsConversationTasks from '~utils/conversation/needsConversationTasks'

function entry(id: string, kind: string, toolName: string | null = null) {
  return { id, kind, toolName } as unknown as ConversationThreadEntry
}

function bodies(texts: Record<string, string>) {
  return new Map(Object.entries(texts).map(([id, text]) => [id, { id, text } as ConversationMessageBody]))
}

describe('needsConversationTasks', () => {
  it('needs the board once a reply links a task, whatever the case of the link’s scheme', () => {
    const entries = [entry('a', 'MEMBER_TEXT'), entry('b', 'AGENT_TEXT')]

    expect(needsConversationTasks(entries, bodies({ b: 'Done: [Post](task:1a2b3c4d5e6f40718293a4b5c6d7e8f9).' }))).toBe(
      true,
    )
    expect(needsConversationTasks(entries, bodies({ b: '[Post](TASK:1a2b3c4d5e6f40718293a4b5c6d7e8f9)' }))).toBe(true)
  })

  it('needs it for a row that deleted a task, in a reply that links no task', () => {
    const entries = [entry('a', 'TOOL_CALL', 'delete_task'), entry('b', 'AGENT_TEXT')]

    expect(needsConversationTasks(entries, bodies({ b: 'I deleted it, as you asked.' }))).toBe(true)
  })

  it('needs none for a thread that links none, a member’s message, a document and another tool alike', () => {
    const entries = [
      entry('a', 'MEMBER_TEXT'),
      entry('b', 'AGENT_TEXT'),
      entry('c', 'TOOL_CALL', 'list_tasks'),
      entry('d', 'TOOL_CALL', 'delete_document'),
    ]

    expect(
      needsConversationTasks(
        entries,
        bodies({
          a: 'task:1a2b3c4d5e6f40718293a4b5c6d7e8f9',
          b: 'See [Pricing](doc:9f8e7d6c5b4a43219f8e7d6c5b4a4321).',
        }),
      ),
    ).toBe(false)
  })
})
