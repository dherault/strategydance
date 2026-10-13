import { describe, expect, it } from 'bun:test'

import { createIntl } from 'react-intl'

import formatConversationAttachmentSize from '~utils/conversation/formatConversationAttachmentSize'

const english = createIntl({ locale: 'en', messages: {} })
const french = createIntl({ locale: 'fr', messages: {} })

describe('formatConversationAttachmentSize', () => {
  it('words bytes, kilobytes and megabytes in 1024s', () => {
    expect(formatConversationAttachmentSize(english, 1)).toBe('1 byte')
    expect(formatConversationAttachmentSize(english, 512)).toBe('512 bytes')
    expect(formatConversationAttachmentSize(english, 1024)).toBe('1 kB')
    expect(formatConversationAttachmentSize(english, 12_800)).toBe('13 kB')
    expect(formatConversationAttachmentSize(english, 1024 * 1024 - 1)).toBe('1,023 kB')
    expect(formatConversationAttachmentSize(english, 2.34 * 1024 * 1024)).toBe('2.3 MB')
    expect(formatConversationAttachmentSize(english, 10 * 1024 * 1024)).toBe('10 MB')
  })

  it("words them in the reader's language", () => {
    expect(formatConversationAttachmentSize(french, 2.34 * 1024 * 1024)).toBe('2,3\u202fMo')
  })
})
