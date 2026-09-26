import { describe, expect, it } from 'bun:test'

import isDarkColor from './isDarkColor'

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

  it('takes lowercase hex as well', () => {
    expect(isDarkColor('#ffff00')).toBe(false)
  })

  it('reads anything that is not six hex digits as dark', () => {
    expect(isDarkColor('')).toBe(true)
    expect(isDarkColor('#FFF')).toBe(true)
    expect(isDarkColor('yellow')).toBe(true)
  })
})
