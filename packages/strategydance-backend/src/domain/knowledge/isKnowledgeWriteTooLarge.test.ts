import { describe, expect, it } from 'bun:test'

import { MAX_KNOWLEDGE_WRITE_REQUEST_BYTES } from '~constants'

import isKnowledgeWriteTooLarge from '~domain/knowledge/isKnowledgeWriteTooLarge'

describe('isKnowledgeWriteTooLarge', () => {
  it('lets through a write up to the bound, its variables as JSON', () => {
    const overhead = Buffer.byteLength(JSON.stringify({ state: '' }))

    expect(isKnowledgeWriteTooLarge({ state: 'a'.repeat(MAX_KNOWLEDGE_WRITE_REQUEST_BYTES - overhead) })).toBe(false)
    expect(isKnowledgeWriteTooLarge({ state: 'a'.repeat(MAX_KNOWLEDGE_WRITE_REQUEST_BYTES - overhead + 1) })).toBe(true)
  })

  it('counts bytes in UTF-8, three a character in Chinese or Japanese, and what JSON escapes', () => {
    const third = Math.ceil(MAX_KNOWLEDGE_WRITE_REQUEST_BYTES / 3)

    expect(isKnowledgeWriteTooLarge({ contentText: '字'.repeat(third) })).toBe(true)
    expect(isKnowledgeWriteTooLarge({ content: '"'.repeat(Math.ceil(MAX_KNOWLEDGE_WRITE_REQUEST_BYTES / 2)) })).toBe(
      true,
    )
  })
})
