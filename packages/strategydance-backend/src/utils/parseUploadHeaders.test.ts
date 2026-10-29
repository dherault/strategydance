import { describe, expect, it } from 'bun:test'

import {
  BILL_RECEIPT_CONTENT_TYPES,
  CONVERSATION_ATTACHMENT_CONTENT_TYPES,
  MAX_BILL_RECEIPT_NAME_LENGTH,
  MAX_BILL_RECEIPT_SIZE,
  MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH,
  MAX_CONVERSATION_ATTACHMENT_SIZE,
} from 'strategydance-core'

import parseUploadHeaders, { type UploadLimits } from './parseUploadHeaders'

const conversationLimits: UploadLimits = {
  contentTypes: CONVERSATION_ATTACHMENT_CONTENT_TYPES,
  maxSize: MAX_CONVERSATION_ATTACHMENT_SIZE,
  maxNameLength: MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH,
  unsupportedReason: 'A conversation takes images, PDFs and text files',
}

// A conversation's file, as its route reads it
function parseConversationAttachmentHeaders(headers: Parameters<typeof parseUploadHeaders>[0]) {
  return parseUploadHeaders(headers, conversationLimits)
}

describe('parseUploadHeaders', () => {
  it('reads the type without its parameters, the size and the decoded name', () => {
    expect(
      parseConversationAttachmentHeaders({
        contentType: 'text/markdown; charset=utf-8',
        contentLength: '1200',
        fileName: encodeURIComponent(' Prix d’été 🌞.md '),
      }),
    ).toEqual({ outcome: 'valid', name: 'Prix d’été 🌞.md', contentType: 'text/markdown', size: 1200 })
  })

  it('refuses a type a conversation does not take', () => {
    expect(
      parseConversationAttachmentHeaders({ contentType: 'image/svg+xml', contentLength: '10', fileName: 'a.svg' }),
    ).toMatchObject({ outcome: 'unsupported' })
  })

  it('refuses a missing, an empty and a too large size', () => {
    expect(parseConversationAttachmentHeaders({ contentType: 'image/png', fileName: 'a.png' })).toMatchObject({
      outcome: 'invalid',
    })
    expect(
      parseConversationAttachmentHeaders({ contentType: 'image/png', contentLength: '0', fileName: 'a.png' }),
    ).toMatchObject({ outcome: 'invalid' })
    expect(
      parseConversationAttachmentHeaders({ contentType: 'image/png', contentLength: '10485761', fileName: 'a.png' }),
    ).toMatchObject({ outcome: 'tooLarge' })
  })

  it('refuses a name badly encoded, empty, on two lines or past 200 characters', () => {
    const upload = { contentType: 'text/plain', contentLength: '10' }

    expect(parseConversationAttachmentHeaders({ ...upload, fileName: '%E0%A4%A' })).toMatchObject({
      outcome: 'invalid',
    })
    expect(parseConversationAttachmentHeaders({ ...upload, fileName: '%20' })).toMatchObject({ outcome: 'invalid' })
    expect(parseConversationAttachmentHeaders({ ...upload, fileName: 'a%0Ab.txt' })).toMatchObject({
      outcome: 'invalid',
    })
    expect(parseConversationAttachmentHeaders({ ...upload, fileName: 'a'.repeat(201) })).toMatchObject({
      outcome: 'invalid',
    })
    expect(parseConversationAttachmentHeaders({ ...upload, fileName: '🌞'.repeat(200) })).toMatchObject({
      outcome: 'valid',
    })
  })

  it("holds a file to its route's own types and size, and says which types it takes", () => {
    const receiptLimits: UploadLimits = {
      contentTypes: BILL_RECEIPT_CONTENT_TYPES,
      maxSize: MAX_BILL_RECEIPT_SIZE,
      maxNameLength: MAX_BILL_RECEIPT_NAME_LENGTH,
      unsupportedReason: 'A receipt is a PDF, a text file or a photo',
    }

    expect(
      parseUploadHeaders({ contentType: 'image/gif', contentLength: '10', fileName: 'a.gif' }, receiptLimits),
    ).toEqual({
      outcome: 'unsupported',
      reason: 'A receipt is a PDF, a text file or a photo',
    })
    expect(
      parseUploadHeaders({ contentType: 'image/webp', contentLength: '10', fileName: 'a.webp' }, receiptLimits),
    ).toMatchObject({ outcome: 'valid' })
    expect(
      parseUploadHeaders(
        { contentType: 'application/pdf', contentLength: String(MAX_BILL_RECEIPT_SIZE + 1), fileName: 'a.pdf' },
        receiptLimits,
      ),
    ).toMatchObject({ outcome: 'tooLarge' })
  })
})
