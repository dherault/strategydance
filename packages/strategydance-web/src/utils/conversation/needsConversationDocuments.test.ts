import { describe, expect, it } from 'bun:test'

import type { ConversationMessageBody, ConversationThreadEntry } from '~types'

import needsConversationDocuments from '~utils/conversation/needsConversationDocuments'

function entry(id: string, kind: string, toolName: string | null = null) {
  return { id, kind, toolName } as unknown as ConversationThreadEntry
}

function bodies(texts: Record<string, string>) {
  return new Map(Object.entries(texts).map(([id, text]) => [id, { id, text } as ConversationMessageBody]))
}

describe('needsConversationDocuments', () => {
  it('needs the documents once a reply links one', () => {
    const entries = [entry('a', 'MEMBER_TEXT'), entry('b', 'AGENT_TEXT')]

    expect(
      needsConversationDocuments(entries, bodies({ b: 'See [Pricing](doc:9f8e7d6c5b4a43219f8e7d6c5b4a4321).' })),
    ).toBe(true)
  })

  it('needs them for a row that deleted one, whatever the replies say', () => {
    expect(needsConversationDocuments([entry('a', 'TOOL_CALL', 'delete_document')], new Map())).toBe(true)
  })

  it('needs none for a thread that links none, a member’s message, a reply not read yet and another tool alike', () => {
    const entries = [
      entry('a', 'MEMBER_TEXT'),
      entry('b', 'AGENT_TEXT'),
      entry('c', 'AGENT_TEXT'),
      entry('d', 'TOOL_CALL', 'read_document'),
    ]

    expect(
      needsConversationDocuments(entries, bodies({ a: 'doc:9f8e7d6c5b4a43219f8e7d6c5b4a4321', b: 'Flat 19.' })),
    ).toBe(false)
  })
})
