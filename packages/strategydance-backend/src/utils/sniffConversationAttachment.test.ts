import { describe, expect, it } from 'bun:test'

import sniffConversationAttachment from './sniffConversationAttachment'

function bytesOf(...parts: (string | number[])[]) {
  return new Uint8Array(
    parts.flatMap(part => (typeof part === 'string' ? [...part].map(character => character.charCodeAt(0)) : part)),
  )
}

const PNG = bytesOf([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a], 'IHDR')
const PDF = bytesOf('%PDF-1.7\n')

describe('sniffConversationAttachment', () => {
  it('takes an image only as the type its signature says', () => {
    expect(sniffConversationAttachment(PNG, 'image/png')).toBe(true)
    expect(sniffConversationAttachment(PNG, 'image/jpeg')).toBe(false)
    expect(sniffConversationAttachment(PDF, 'image/png')).toBe(false)
  })

  it('takes a PDF only when it starts as one', () => {
    expect(sniffConversationAttachment(PDF, 'application/pdf')).toBe(true)
    expect(sniffConversationAttachment(bytesOf('Hello'), 'application/pdf')).toBe(false)
  })

  it('takes text that carries no binary signature and no NUL', () => {
    expect(sniffConversationAttachment(bytesOf('# Pricing\n\n- Flat'), 'text/markdown')).toBe(true)
    expect(sniffConversationAttachment(bytesOf('name,price\nbeta,19'), 'text/csv')).toBe(true)
    expect(sniffConversationAttachment(PNG, 'text/plain')).toBe(false)
    expect(sniffConversationAttachment(PDF, 'text/plain')).toBe(false)
    expect(sniffConversationAttachment(bytesOf([0x50, 0x4b, 0x03, 0x04], 'word/'), 'text/plain')).toBe(false)
    expect(sniffConversationAttachment(bytesOf('H', [0], 'i', [0]), 'text/plain')).toBe(false)
  })
})
