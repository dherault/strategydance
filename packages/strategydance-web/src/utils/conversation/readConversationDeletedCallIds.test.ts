import { describe, expect, it } from 'bun:test'

import type { ConversationThreadEntry } from '~types'

import readConversationDeletedCallIds from '~utils/conversation/readConversationDeletedCallIds'

function entry(id: string, toolName: string, toolStatus = 'SUCCEEDED', kind = 'TOOL_CALL') {
  return { id, kind, toolName, toolStatus } as unknown as ConversationThreadEntry
}

describe('readConversationDeletedCallIds', () => {
  it('reads the deletes of documents and tasks that succeeded, sorted, and nothing else', () => {
    expect(
      readConversationDeletedCallIds([
        entry('c', 'delete_document'),
        entry('a', 'delete_document'),
        entry('g', 'delete_task'),
        entry('b', 'delete_document', 'FAILED'),
        entry('d', 'delete_task', 'RUNNING'),
        entry('e', 'restore_document'),
        entry('h', 'restore_task'),
        entry('f', 'delete_document', 'SUCCEEDED', 'AGENT_TEXT'),
      ]),
    ).toEqual(['a', 'c', 'g'])
  })

  it('reads every one, however many the thread holds', () => {
    const entries = Array.from({ length: 60 }, (_, index) =>
      entry(String(index).padStart(2, '0'), index % 2 ? 'delete_task' : 'delete_document'),
    )

    expect(readConversationDeletedCallIds(entries)).toEqual(entries.map(({ id }) => id))
  })
})
