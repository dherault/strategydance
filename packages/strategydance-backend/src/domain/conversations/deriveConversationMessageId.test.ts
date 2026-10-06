import { describe, expect, test } from 'bun:test'

import deriveConversationMessageId from './deriveConversationMessageId'

const ENTRY_ID = '0f9c2b8e-4b1a-4d2c-9e7f-6a5b4c3d2e1f'

describe('deriveConversationMessageId', () => {
  test('derives the same id from the same parts', () => {
    expect(deriveConversationMessageId(ENTRY_ID, 0, 0)).toBe(deriveConversationMessageId(ENTRY_ID, 0, 0))
  })

  test('derives another id from another block, piece or entry', () => {
    const ids = new Set([
      deriveConversationMessageId(ENTRY_ID, 0, 0),
      deriveConversationMessageId(ENTRY_ID, 1, 0),
      deriveConversationMessageId(ENTRY_ID, 0, 1),
      deriveConversationMessageId('1f9c2b8e-4b1a-4d2c-9e7f-6a5b4c3d2e1f', 0, 0),
      deriveConversationMessageId(ENTRY_ID, 'note'),
    ])

    expect(ids.size).toBe(5)
  })

  test('reads an id the same with hyphens or without, in either case', () => {
    const id = deriveConversationMessageId(ENTRY_ID, 'note')

    expect(deriveConversationMessageId(ENTRY_ID.replaceAll('-', ''), 'note')).toBe(id)
    expect(deriveConversationMessageId(ENTRY_ID.toUpperCase(), 'note')).toBe(id)
  })

  test('writes a version 8 UUID as Data Connect writes one back', () => {
    for (let block = 0; block < 50; block++) {
      expect(deriveConversationMessageId(ENTRY_ID, block, 0)).toMatch(/^[0-9a-f]{12}8[0-9a-f]{3}[89ab][0-9a-f]{15}$/)
    }
  })
})
