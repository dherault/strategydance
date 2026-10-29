import { describe, expect, it } from 'bun:test'

import { MAX_DOCUMENT_WRITE_REQUEST_BYTES } from '~constants'

import isDocumentWriteTooLarge from '~domain/documents/isDocumentWriteTooLarge'

describe('isDocumentWriteTooLarge', () => {
  it('lets through a write up to the bound, its variables as JSON', () => {
    const overhead = Buffer.byteLength(JSON.stringify({ state: '' }))

    expect(isDocumentWriteTooLarge({ state: 'a'.repeat(MAX_DOCUMENT_WRITE_REQUEST_BYTES - overhead) })).toBe(false)
    expect(isDocumentWriteTooLarge({ state: 'a'.repeat(MAX_DOCUMENT_WRITE_REQUEST_BYTES - overhead + 1) })).toBe(true)
  })

  it('counts bytes in UTF-8, three a character in Chinese or Japanese, and what JSON escapes', () => {
    const third = Math.ceil(MAX_DOCUMENT_WRITE_REQUEST_BYTES / 3)

    expect(isDocumentWriteTooLarge({ contentText: '字'.repeat(third) })).toBe(true)
    expect(isDocumentWriteTooLarge({ content: '"'.repeat(Math.ceil(MAX_DOCUMENT_WRITE_REQUEST_BYTES / 2)) })).toBe(true)
  })
})
