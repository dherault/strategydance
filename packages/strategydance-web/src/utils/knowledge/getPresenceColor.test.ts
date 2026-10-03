import { describe, expect, it } from 'bun:test'

import getPresenceColor, { PRESENCE_COLORS } from '~utils/knowledge/getPresenceColor'

describe('getPresenceColor', () => {
  it('gives one person the same color every time', () => {
    expect(getPresenceColor('uid-ana')).toBe(getPresenceColor('uid-ana'))
  })

  it('picks from the palette, in six-digit hex', () => {
    for (const userId of ['a', 'uid-ana', 'uid-ben', 'x'.repeat(40)]) {
      expect(PRESENCE_COLORS).toContain(getPresenceColor(userId))
    }

    for (const color of PRESENCE_COLORS) expect(color).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('spreads people across the palette', () => {
    const colors = new Set(Array.from({ length: 64 }, (_, index) => getPresenceColor(`uid-${index}`)))

    expect(colors.size).toBeGreaterThan(PRESENCE_COLORS.length / 2)
  })
})
