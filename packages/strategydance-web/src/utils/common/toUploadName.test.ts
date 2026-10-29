import { describe, expect, it } from 'bun:test'

import { MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH } from 'strategydance-core'

import toUploadName from '~utils/common/toUploadName'

describe('toUploadName', () => {
  it('keeps a name that fits as it is, trimmed', () => {
    expect(toUploadName('  Q3 plan (final).pdf ', 'Pasted file', MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH)).toBe(
      'Q3 plan (final).pdf',
    )
  })

  it('puts a name on one line, without control characters', () => {
    expect(toUploadName('plan\nfor\tQ3\u0000.md', 'Pasted file', MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH)).toBe(
      'plan for Q3 .md',
    )
    expect(toUploadName('a\u2028b.txt', 'Pasted file', MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH)).toBe('a b.txt')
  })

  it('takes the fallback for a name with nothing left', () => {
    expect(toUploadName('', 'Pasted image', MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH)).toBe('Pasted image')
    expect(toUploadName(' \n ', 'Pasted image', MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH)).toBe('Pasted image')
  })

  it('cuts a long name before its extension, between graphemes', () => {
    const name = toUploadName(`${'a'.repeat(198)}👩‍💻.pdf`, 'Pasted file', MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH)

    expect(name).toBe(`${'a'.repeat(196)}.pdf`)
    expect([...name].length).toBeLessThanOrEqual(MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH)

    const long = toUploadName(`${'b'.repeat(300)}.markdown`, 'Pasted file', MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH)

    expect(long.endsWith('.markdown')).toBe(true)
    expect([...long].length).toBe(MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH)
  })

  it('cuts a long name whose extension is too long to keep as one', () => {
    const name = toUploadName(`notes.${'x'.repeat(300)}`, 'Pasted file', MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH)

    expect([...name].length).toBe(MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH)
    expect(name.startsWith('notes.x')).toBe(true)
  })
})
