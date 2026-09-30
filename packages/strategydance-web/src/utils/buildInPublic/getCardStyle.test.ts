import { describe, expect, it } from 'bun:test'

import getCardStyle from '~utils/buildInPublic/getCardStyle'

function read(style: object, name: string) {
  return (style as Record<string, string>)[name]
}

describe('getCardStyle', () => {
  it('writes in white on a dark accent, and in black on a light one', () => {
    expect(read(getCardStyle('accent', '#0051A3'), '--card-on-accent')).toBe('#ffffff')
    expect(read(getCardStyle('accent', '#FDE047'), '--card-on-accent')).toBe('#000000')
  })

  it('draws the card on its tone', () => {
    expect(read(getCardStyle('white', '#0051A3'), '--card-background')).toBe('#ffffff')
    expect(read(getCardStyle('accent', '#0051A3'), '--card-background')).toBe('var(--card-accent)')
    expect(read(getCardStyle('dark', '#0051A3'), '--card-background')).toBe('var(--color-secondary-900)')
  })

  it('outlines only a white card, which would otherwise melt into the page', () => {
    expect(read(getCardStyle('white', '#0051A3'), '--card-ring')).not.toBe('none')
    expect(read(getCardStyle('tint', '#0051A3'), '--card-ring')).toBe('none')
  })

  it('draws a track that shows on the tinted card', () => {
    expect(read(getCardStyle('tint', '#0051A3'), '--card-track')).toBe('#ffffff')
    expect(read(getCardStyle('white', '#0051A3'), '--card-track')).toBe('var(--card-accent-100)')
  })

  it('draws a warm flame whatever the tone', () => {
    const accent = getCardStyle('accent', '#0051A3', 'warm')
    const white = getCardStyle('white', '#0051A3', 'warm')

    expect(read(accent, '--flame-outer')).toBe(read(white, '--flame-outer'))
    expect(read(accent, '--flame-outer')).not.toBe(read(getCardStyle('accent', '#0051A3'), '--flame-outer'))
  })
})
