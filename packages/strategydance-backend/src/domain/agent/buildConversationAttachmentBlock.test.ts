import { describe, expect, it } from 'bun:test'

import buildConversationAttachmentBlock from './buildConversationAttachmentBlock'

const BYTES = new TextEncoder().encode('# Pricing')

describe('buildConversationAttachmentBlock', () => {
  it('references an image, a PDF and a text file by their ids, the documents titled', () => {
    expect(
      buildConversationAttachmentBlock({ name: 'Board.png', contentType: 'image/png' }, { fileId: 'file_1' }),
    ).toEqual({
      type: 'image',
      source: { type: 'file', file_id: 'file_1' },
    })
    expect(
      JSON.stringify(
        buildConversationAttachmentBlock({ name: 'Plan.pdf', contentType: 'application/pdf' }, { fileId: 'file_2' }),
      ),
    ).toBe('{"type":"document","source":{"type":"file","file_id":"file_2"},"title":"Plan.pdf"}')
    expect(
      buildConversationAttachmentBlock({ name: 'Notes.md', contentType: 'text/markdown' }, { fileId: 'file_3' }),
    ).toEqual({ type: 'document', source: { type: 'file', file_id: 'file_3' }, title: 'Notes.md' })
  })

  it('carries the same file inline for its count, text as plain text', () => {
    expect(buildConversationAttachmentBlock({ name: 'Board.png', contentType: 'image/png' }, { bytes: BYTES })).toEqual(
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: Buffer.from(BYTES).toString('base64') },
      },
    )
    expect(buildConversationAttachmentBlock({ name: 'Prices.csv', contentType: 'text/csv' }, { bytes: BYTES })).toEqual(
      {
        type: 'document',
        source: { type: 'text', media_type: 'text/plain', data: '# Pricing' },
        title: 'Prices.csv',
      },
    )
  })
})
