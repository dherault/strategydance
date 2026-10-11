import { describe, expect, it } from 'bun:test'

import readConversationDocumentId from '~utils/conversation/readConversationDocumentId'

describe('readConversationDocumentId', () => {
  it('reads a document’s id as Data Connect writes it, its hyphens and case aside', () => {
    expect(readConversationDocumentId('doc:9f8e7d6c5b4a43219f8e7d6c5b4a4321')).toBe('9f8e7d6c5b4a43219f8e7d6c5b4a4321')
    expect(readConversationDocumentId('doc:9F8E7D6C-5B4A-4321-9F8E-7D6C5B4A4321')).toBe(
      '9f8e7d6c5b4a43219f8e7d6c5b4a4321',
    )
  })

  it('reads nothing from a link that names no document', () => {
    expect(readConversationDocumentId('doc:')).toBeNull()
    expect(readConversationDocumentId('doc:pricing')).toBeNull()
    expect(readConversationDocumentId('doc:9f8e7d6c5b4a43219f8e7d6c5b4a432')).toBeNull()
    expect(readConversationDocumentId('https://strategydance.com/doc:9f8e7d6c5b4a43219f8e7d6c5b4a4321')).toBeNull()
  })
})
