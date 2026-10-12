import { describe, expect, it } from 'bun:test'

import { MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH } from 'strategydance-core'

import toConversationAttachmentName from '~utils/conversation/toConversationAttachmentName'

describe('toConversationAttachmentName', () => {
  it('keeps a name that fits as it is, trimmed', () => {
    expect(toConversationAttachmentName('  Q3 plan (final).pdf ', 'Pasted file')).toBe('Q3 plan (final).pdf')
  })

  it('puts a name on one line, without control characters', () => {
    expect(toConversationAttachmentName('plan\nfor\tQ3\u0000.md', 'Pasted file')).toBe('plan for Q3 .md')
    expect(toConversationAttachmentName('a\u2028b.txt', 'Pasted file')).toBe('a b.txt')
  })

  it('takes the fallback for a name with nothing left', () => {
    expect(toConversationAttachmentName('', 'Pasted image')).toBe('Pasted image')
    expect(toConversationAttachmentName(' \n ', 'Pasted image')).toBe('Pasted image')
  })

  it('cuts a long name before its extension, between graphemes', () => {
    const name = toConversationAttachmentName(`${'a'.repeat(198)}👩‍💻.pdf`, 'Pasted file')

    expect(name).toBe(`${'a'.repeat(196)}.pdf`)
    expect([...name].length).toBeLessThanOrEqual(MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH)

    const long = toConversationAttachmentName(`${'b'.repeat(300)}.markdown`, 'Pasted file')

    expect(long.endsWith('.markdown')).toBe(true)
    expect([...long].length).toBe(MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH)
  })

  it('cuts a long name whose extension is too long to keep as one', () => {
    const name = toConversationAttachmentName(`notes.${'x'.repeat(300)}`, 'Pasted file')

    expect([...name].length).toBe(MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH)
    expect(name.startsWith('notes.x')).toBe(true)
  })
})
