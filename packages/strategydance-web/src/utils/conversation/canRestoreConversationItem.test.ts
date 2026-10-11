import { describe, expect, it } from 'bun:test'

import type { KnowledgeDocumentSummary, Task } from '~types'

import canRestoreConversationItem from '~utils/conversation/canRestoreConversationItem'
import readConversationDeletedItem from '~utils/conversation/readConversationDeletedItem'

const DOCUMENT_ID = '9f8e7d6c5b4a43219f8e7d6c5b4a4321'
const TASK_ID = '1a2b3c4d5e6f40718293a4b5c6d7e8f9'
const NOW = Date.parse('2026-10-11T12:00:00.000Z')

const deleted = readConversationDeletedItem(
  JSON.stringify({ id: DOCUMENT_ID, restorableUntil: '2026-10-12T11:00:00.000Z' }),
)

// A delete_task call's output, its id written as the module writes one
const deletedTask = readConversationDeletedItem(
  JSON.stringify({ id: '1a2b3c4d-5e6f-4071-8293-a4b5c6d7e8f9', restorableUntil: '2026-10-12T11:00:00.000Z' }),
)

function documents(...ids: string[]) {
  return new Map(ids.map(id => [id, { id } as KnowledgeDocumentSummary]))
}

function board(...ids: string[]) {
  return new Map(ids.map(id => [id, { id } as Task]))
}

describe('readConversationDeletedItem', () => {
  it('reads what was deleted and when its restore stops being offered from what the call answered', () => {
    expect(deleted).toEqual({ id: DOCUMENT_ID, restorableUntil: Date.parse('2026-10-12T11:00:00.000Z') })
    expect(deletedTask?.id).toBe(TASK_ID)
    expect(
      readConversationDeletedItem(
        JSON.stringify({ id: '9F8E7D6C-5B4A-4321-9F8E-7D6C5B4A4321', restorableUntil: '2026-10-12T11:00:00.000Z' }),
      )?.id,
    ).toBe(DOCUMENT_ID)
  })

  it('reads nothing from an output that says anything else', () => {
    expect(readConversationDeletedItem(null)).toBeNull()
    expect(readConversationDeletedItem('{"error":"The team keeps AI from changing this document."}')).toBeNull()
    expect(readConversationDeletedItem('not JSON')).toBeNull()
    expect(readConversationDeletedItem(JSON.stringify({ id: DOCUMENT_ID, restorableUntil: 'soon' }))).toBeNull()
  })
})

describe('canRestoreConversationItem', () => {
  it('offers to restore a document the organization no longer holds, within a day of its delete', () => {
    expect(canRestoreConversationItem(deleted, documents('other'), NOW)).toBe(true)
  })

  it('offers nothing once the document is back, the day has passed, or before the documents are read', () => {
    expect(canRestoreConversationItem(deleted, documents(DOCUMENT_ID), NOW)).toBe(false)
    expect(canRestoreConversationItem(deleted, documents(), Date.parse('2026-10-12T11:00:00.000Z'))).toBe(false)
    expect(canRestoreConversationItem(deleted, null, NOW)).toBe(false)
    expect(canRestoreConversationItem(null, documents(), NOW)).toBe(false)
  })

  it('offers to restore a task while it is off the board within its day, and nothing once it is back', () => {
    expect(canRestoreConversationItem(deletedTask, board('other'), NOW)).toBe(true)
    expect(canRestoreConversationItem(deletedTask, board(TASK_ID), NOW)).toBe(false)
    expect(canRestoreConversationItem(deletedTask, board(), Date.parse('2026-10-12T11:00:00.000Z'))).toBe(false)
  })
})
