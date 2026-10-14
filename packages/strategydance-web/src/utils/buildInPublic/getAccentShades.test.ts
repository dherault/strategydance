import { describe, expect, it } from 'bun:test'

import { CARD_ACCENT_COLORS } from '~constants'

import getAccentShades, { getContrast, toRgb } from '~utils/buildInPublic/getAccentShades'

// What the shades are checked against: the tinted card's panel and light gray, then navy's panel
const LIGHT_BACKGROUNDS = ['#f5f5f5', '#ffffff']
const NAVY_PANEL = '#20354c'

function contrast(first: string, second: string) {
  return getContrast(toRgb(first)!, toRgb(second)!)
}

describe('getAccentShades', () => {
  it('keeps a dark accent as it is', () => {
    expect(getAccentShades('#0051A3').ink).toBe('#0051a3')
  })

  it('darkens a light accent until it reads on the light cards', () => {
    const { ink } = getAccentShades('#FDE047')

    expect(ink).not.toBe('#fde047')

    for (const background of LIGHT_BACKGROUNDS) expect(contrast(ink, background)).toBeGreaterThanOrEqual(4.6)
  })

  it('lightens a dark accent until it reads on navy', () => {
    const { high } = getAccentShades('#142A41')

    expect(contrast(high, NAVY_PANEL)).toBeGreaterThanOrEqual(4.6)
  })

  it('reads on every card for every accent a card can take', () => {
    for (const accent of [...Object.values(CARD_ACCENT_COLORS), '#FDE047', '#A3E635', '#38BDF8', '#ffffff']) {
      const { ink, high } = getAccentShades(accent)

      for (const background of LIGHT_BACKGROUNDS) expect(contrast(ink, background)).toBeGreaterThanOrEqual(4.6)
      expect(contrast(high, NAVY_PANEL)).toBeGreaterThanOrEqual(4.6)
    }
  })

  it('leaves what is not a hex color alone', () => {
    expect(getAccentShades('var(--primary)')).toEqual({ ink: 'var(--primary)', high: 'var(--primary)' })
  })
})
