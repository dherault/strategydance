import { describe, expect, it } from 'bun:test'

import { MAX_CONVERSATION_ATTACHMENT_SIZE, MAX_CONVERSATION_IMAGE_SIZE } from 'strategydance-core'

import getConversationAttachmentRefusal from '~utils/conversation/getConversationAttachmentRefusal'

describe('getConversationAttachmentRefusal', () => {
  it('lets a file a conversation takes go up', () => {
    expect(getConversationAttachmentRefusal({ size: 1024 }, 'application/pdf')).toBeNull()
    expect(getConversationAttachmentRefusal({ size: MAX_CONVERSATION_ATTACHMENT_SIZE }, 'text/csv')).toBeNull()
    expect(getConversationAttachmentRefusal({ size: MAX_CONVERSATION_IMAGE_SIZE }, 'image/gif')).toBeNull()
  })

  it('lets an image the browser shrinks go up whatever its size', () => {
    expect(getConversationAttachmentRefusal({ size: 3 * MAX_CONVERSATION_ATTACHMENT_SIZE }, 'image/jpeg')).toBeNull()
    expect(getConversationAttachmentRefusal({ size: 3 * MAX_CONVERSATION_ATTACHMENT_SIZE }, 'image/png')).toBeNull()
    expect(getConversationAttachmentRefusal({ size: 3 * MAX_CONVERSATION_ATTACHMENT_SIZE }, 'image/webp')).toBeNull()
  })

  it('refuses a GIF past what Claude takes of an image, and any other file past what a conversation takes', () => {
    expect(getConversationAttachmentRefusal({ size: MAX_CONVERSATION_IMAGE_SIZE + 1 }, 'image/gif')).toBe(
      'imageTooLarge',
    )
    expect(getConversationAttachmentRefusal({ size: MAX_CONVERSATION_ATTACHMENT_SIZE + 1 }, 'application/pdf')).toBe(
      'tooLarge',
    )
  })

  it('refuses a type a conversation does not take, and an empty file', () => {
    expect(getConversationAttachmentRefusal({ size: 10 }, null)).toBe('unsupported')
    expect(getConversationAttachmentRefusal({ size: 0 }, 'text/plain')).toBe('empty')
  })
})
