import { describe, expect, it } from 'bun:test'

import type { KnowledgeDocumentSummary } from '~types'

import canRestoreConversationDocument from '~utils/conversation/canRestoreConversationDocument'
import readConversationDeletedDocument from '~utils/conversation/readConversationDeletedDocument'

const DOCUMENT_ID = '9f8e7d6c5b4a43219f8e7d6c5b4a4321'
const NOW = Date.parse('2026-10-11T12:00:00.000Z')

const deleted = readConversationDeletedDocument(
  JSON.stringify({ id: DOCUMENT_ID, restorableUntil: '2026-10-12T11:00:00.000Z' }),
)

function documents(...ids: string[]) {
  return new Map(ids.map(id => [id, { id } as KnowledgeDocumentSummary]))
}

describe('readConversationDeletedDocument', () => {
  it('reads the document and when its restore stops being offered from what the call answered', () => {
    expect(deleted).toEqual({ documentId: DOCUMENT_ID, restorableUntil: Date.parse('2026-10-12T11:00:00.000Z') })
    expect(
      readConversationDeletedDocument(
        JSON.stringify({ id: '9F8E7D6C-5B4A-4321-9F8E-7D6C5B4A4321', restorableUntil: '2026-10-12T11:00:00.000Z' }),
      )?.documentId,
    ).toBe(DOCUMENT_ID)
  })

  it('reads nothing from an output that says anything else', () => {
    expect(readConversationDeletedDocument(null)).toBeNull()
    expect(readConversationDeletedDocument('{"error":"The team keeps AI from changing this document."}')).toBeNull()
    expect(readConversationDeletedDocument('not JSON')).toBeNull()
    expect(readConversationDeletedDocument(JSON.stringify({ id: DOCUMENT_ID, restorableUntil: 'soon' }))).toBeNull()
  })
})

describe('canRestoreConversationDocument', () => {
  it('offers to restore a document the organization no longer holds, within a day of its delete', () => {
    expect(canRestoreConversationDocument(deleted, documents('other'), NOW)).toBe(true)
  })

  it('offers nothing once the document is back, the day has passed, or before the documents are read', () => {
    expect(canRestoreConversationDocument(deleted, documents(DOCUMENT_ID), NOW)).toBe(false)
    expect(canRestoreConversationDocument(deleted, documents(), Date.parse('2026-10-12T11:00:00.000Z'))).toBe(false)
    expect(canRestoreConversationDocument(deleted, null, NOW)).toBe(false)
    expect(canRestoreConversationDocument(null, documents(), NOW)).toBe(false)
  })
})
