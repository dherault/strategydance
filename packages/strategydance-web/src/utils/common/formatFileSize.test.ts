import { describe, expect, it } from 'bun:test'

import { createIntl } from 'react-intl'

import formatFileSize from '~utils/common/formatFileSize'

const english = createIntl({ locale: 'en', messages: {} })
const french = createIntl({ locale: 'fr', messages: {} })

describe('formatFileSize', () => {
  it('words bytes, kilobytes and megabytes in 1024s', () => {
    expect(formatFileSize(english, 1)).toBe('1 byte')
    expect(formatFileSize(english, 512)).toBe('512 bytes')
    expect(formatFileSize(english, 1024)).toBe('1 kB')
    expect(formatFileSize(english, 12_800)).toBe('13 kB')
    expect(formatFileSize(english, 1024 * 1024 - 1)).toBe('1,023 kB')
    expect(formatFileSize(english, 2.34 * 1024 * 1024)).toBe('2.3 MB')
    expect(formatFileSize(english, 10 * 1024 * 1024)).toBe('10 MB')
  })

  it("words them in the reader's language", () => {
    expect(formatFileSize(french, 2.34 * 1024 * 1024)).toBe('2,3\u202fMo')
  })
})
