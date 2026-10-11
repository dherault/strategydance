import { describe, expect, it } from 'bun:test'

import type { ConversationThreadEntry } from '~types'

import readConversationDeletedDocumentIds from '~utils/conversation/readConversationDeletedDocumentIds'

function entry(id: string, toolName: string, toolStatus = 'SUCCEEDED', kind = 'TOOL_CALL') {
  return { id, kind, toolName, toolStatus } as unknown as ConversationThreadEntry
}

describe('readConversationDeletedDocumentIds', () => {
  it('reads the deletes that succeeded, sorted, and nothing else', () => {
    expect(
      readConversationDeletedDocumentIds([
        entry('c', 'delete_document'),
        entry('a', 'delete_document'),
        entry('b', 'delete_document', 'FAILED'),
        entry('d', 'delete_document', 'RUNNING'),
        entry('e', 'restore_document'),
        entry('f', 'delete_document', 'SUCCEEDED', 'AGENT_TEXT'),
      ]),
    ).toEqual(['a', 'c'])
  })

  it('reads every one, however many the thread holds', () => {
    const entries = Array.from({ length: 60 }, (_, index) => entry(String(index).padStart(2, '0'), 'delete_document'))

    expect(readConversationDeletedDocumentIds(entries)).toEqual(entries.map(({ id }) => id))
  })
})
