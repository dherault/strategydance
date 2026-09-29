import { describe, expect, it } from 'bun:test'

import { isDarkColor } from 'strategydance-design-system/lib/isDarkColor'

function toLinear(channel: number) {
  const value = channel / 255

  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

// The contrast of white or black text, whichever the helper picks, on a background
function contrastOfPick(red: number, green: number, blue: number) {
  const hex = `#${[red, green, blue].map(channel => channel.toString(16).padStart(2, '0')).join('')}`
  const luminance = 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue)

  return isDarkColor(hex) ? 1.05 / (luminance + 0.05) : (luminance + 0.05) / 0.05
}

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

  it('picks a text reaching 4.5:1 on every gray', () => {
    for (let channel = 0; channel < 256; channel++) {
      expect(contrastOfPick(channel, channel, channel)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('picks a text reaching 4.5:1 on every color, sampled every 15 steps of each channel', () => {
    for (let red = 0; red < 256; red += 15) {
      for (let green = 0; green < 256; green += 15) {
        for (let blue = 0; blue < 256; blue += 15) {
          expect(contrastOfPick(red, green, blue)).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
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
