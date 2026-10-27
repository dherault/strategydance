import { describe, expect, it } from 'bun:test'

import { BILL_RECEIPT_CONTENT_TYPES, CONVERSATION_ATTACHMENT_CONTENT_TYPES } from 'strategydance-core'

import readFileType from '~utils/common/readFileType'

describe('readFileType', () => {
  it("takes the browser's type when the destination takes it", () => {
    expect(readFileType({ name: 'photo.jpg', type: 'image/jpeg' }, CONVERSATION_ATTACHMENT_CONTENT_TYPES)).toBe(
      'image/jpeg',
    )
    expect(
      readFileType({ name: 'notes', type: 'text/plain;charset=utf-8' }, CONVERSATION_ATTACHMENT_CONTENT_TYPES),
    ).toBe('text/plain')
    expect(readFileType({ name: 'image.png', type: 'IMAGE/PNG' }, CONVERSATION_ATTACHMENT_CONTENT_TYPES)).toBe(
      'image/png',
    )
  })

  it('reads the extension when the browser gives no type, or one of its own', () => {
    expect(readFileType({ name: 'plan.md', type: '' }, CONVERSATION_ATTACHMENT_CONTENT_TYPES)).toBe('text/markdown')
    expect(
      readFileType({ name: 'Plan.MARKDOWN', type: 'text/x-markdown' }, CONVERSATION_ATTACHMENT_CONTENT_TYPES),
    ).toBe('text/markdown')
    expect(
      readFileType({ name: 'costs.csv', type: 'application/vnd.ms-excel' }, CONVERSATION_ATTACHMENT_CONTENT_TYPES),
    ).toBe('text/csv')
    expect(
      readFileType({ name: 'deck.pdf', type: 'application/octet-stream' }, CONVERSATION_ATTACHMENT_CONTENT_TYPES),
    ).toBe('application/pdf')
  })

  it('refuses a file the destination does not take', () => {
    expect(readFileType({ name: 'logo.svg', type: 'image/svg+xml' }, CONVERSATION_ATTACHMENT_CONTENT_TYPES)).toBeNull()
    expect(readFileType({ name: 'photo.heic', type: 'image/heic' }, CONVERSATION_ATTACHMENT_CONTENT_TYPES)).toBeNull()
    expect(readFileType({ name: 'report.docx', type: '' }, CONVERSATION_ATTACHMENT_CONTENT_TYPES)).toBeNull()
    expect(readFileType({ name: 'README', type: '' }, CONVERSATION_ATTACHMENT_CONTENT_TYPES)).toBeNull()
  })

  it("refuses a type its extension names when the destination does not take it, as a bill's GIF", () => {
    expect(readFileType({ name: 'receipt.gif', type: 'image/gif' }, BILL_RECEIPT_CONTENT_TYPES)).toBeNull()
    expect(readFileType({ name: 'receipt.gif', type: '' }, BILL_RECEIPT_CONTENT_TYPES)).toBeNull()
    expect(readFileType({ name: 'receipt.md', type: '' }, BILL_RECEIPT_CONTENT_TYPES)).toBe('text/markdown')
  })
})
