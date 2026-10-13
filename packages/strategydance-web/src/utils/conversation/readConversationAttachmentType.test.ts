import { describe, expect, it } from 'bun:test'

import readConversationAttachmentType from '~utils/conversation/readConversationAttachmentType'

describe('readConversationAttachmentType', () => {
  it("takes the browser's type when a conversation takes it", () => {
    expect(readConversationAttachmentType({ name: 'photo.jpg', type: 'image/jpeg' })).toBe('image/jpeg')
    expect(readConversationAttachmentType({ name: 'notes', type: 'text/plain;charset=utf-8' })).toBe('text/plain')
    expect(readConversationAttachmentType({ name: 'image.png', type: 'IMAGE/PNG' })).toBe('image/png')
  })

  it('reads the extension when the browser gives no type, or one of its own', () => {
    expect(readConversationAttachmentType({ name: 'plan.md', type: '' })).toBe('text/markdown')
    expect(readConversationAttachmentType({ name: 'Plan.MARKDOWN', type: 'text/x-markdown' })).toBe('text/markdown')
    expect(readConversationAttachmentType({ name: 'costs.csv', type: 'application/vnd.ms-excel' })).toBe('text/csv')
    expect(readConversationAttachmentType({ name: 'deck.pdf', type: 'application/octet-stream' })).toBe(
      'application/pdf',
    )
  })

  it('refuses a file a conversation does not take', () => {
    expect(readConversationAttachmentType({ name: 'logo.svg', type: 'image/svg+xml' })).toBeNull()
    expect(readConversationAttachmentType({ name: 'photo.heic', type: 'image/heic' })).toBeNull()
    expect(readConversationAttachmentType({ name: 'report.docx', type: '' })).toBeNull()
    expect(readConversationAttachmentType({ name: 'README', type: '' })).toBeNull()
  })
})
