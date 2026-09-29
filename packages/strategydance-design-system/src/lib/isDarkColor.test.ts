import { describe, expect, it } from 'bun:test'

import { isDarkColor } from 'strategydance-design-system/lib/isDarkColor'

describe('isDarkColor', () => {
  it('reads the brand colors and black as dark', () => {
    expect(isDarkColor('#0051A3')).toBe(true)
    expect(isDarkColor('#142A41')).toBe(true)
    expect(isDarkColor('#000000')).toBe(true)
  })

  it('reads white, yellow and pale tints as light', () => {
    expect(isDarkColor('#FFFFFF')).toBe(false)
    expect(isDarkColor('#FFFF00')).toBe(false)
    expect(isDarkColor('#BFDBFE')).toBe(false)
  })

  it('reads a mid gray as dark, where white contrasts more than near black does', () => {
    // 4.54:1 against white, 4.36:1 against #0A0A0A, although 4.62:1 against pure black
    expect(isDarkColor('#767676')).toBe(true)
  })

  it('takes lowercase hex as well', () => {
    expect(isDarkColor('#ffff00')).toBe(false)
  })

  it('reads anything that is not six hex digits as dark', () => {
    expect(isDarkColor('')).toBe(true)
    expect(isDarkColor('#FFF')).toBe(true)
    expect(isDarkColor('yellow')).toBe(true)
  })
})
