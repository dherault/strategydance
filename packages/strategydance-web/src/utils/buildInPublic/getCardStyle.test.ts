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

  it('draws the logo so that it stands apart from every tone', () => {
    expect(read(getCardStyle('white', '#0051A3'), '--card-logo-background')).toBe('var(--card-accent)')
    expect(read(getCardStyle('accent', '#0051A3'), '--card-logo-background')).toBe('var(--card-on-accent)')
    expect(read(getCardStyle('dark', '#142A41'), '--card-logo-ring')).not.toBe('none')
  })

  it('keeps an inverted logo white on the accent alone', () => {
    expect(read(getCardStyle('accent', '#FDE047'), '--card-inverted-logo-background')).toBe('#ffffff')
    expect(read(getCardStyle('white', '#FDE047'), '--card-inverted-logo-background')).toBe('var(--card-accent)')
  })

  it('marks things in a shade of the accent that reads on the card', () => {
    const light = getCardStyle('white', '#FDE047')
    const dark = getCardStyle('dark', '#142A41')

    expect(read(light, '--card-mark')).toBe('var(--card-accent-ink)')
    expect(read(light, '--card-accent-ink')).not.toBe('#fde047')
    expect(read(dark, '--card-eyebrow')).toBe('var(--card-accent-high)')
  })

  it('darkens the accent into a panel under white text, and lightens it under black', () => {
    expect(read(getCardStyle('accent', '#0051A3'), '--card-accent-shade')).toBe('black')
    expect(read(getCardStyle('accent', '#FDE047'), '--card-accent-shade')).toBe('white')
  })

  it('outlines a lit day only where its background can melt into the card', () => {
    expect(read(getCardStyle('white', '#0051A3'), '--card-cell-ring')).toBe('none')
    expect(read(getCardStyle('dark', '#0051A3'), '--card-cell-ring')).not.toBe('none')
    expect(read(getCardStyle('dark', '#0051A3', 'warm'), '--card-cell-ring')).toBe('none')
  })

  it('writes in the forced ink, which the accent tone marks things in too', () => {
    const accent = getCardStyle('accent', '#0051A3', 'organization', 'black')
    const white = getCardStyle('white', '#0051A3', 'organization', 'white')

    expect(read(accent, '--card-on-accent')).toBe('#000000')
    expect(read(accent, '--card-accent-shade')).toBe('white')
    expect(read(white, '--card-foreground')).toBe('#ffffff')
    expect(read(white, '--card-mark')).toBe('var(--card-accent-ink)')
    expect(read(getCardStyle('white', '#0051A3'), '--card-foreground')).toBe('var(--color-secondary-900)')
  })

  it('draws a warm flame whatever the tone', () => {
    const accent = getCardStyle('accent', '#0051A3', 'warm')
    const white = getCardStyle('white', '#0051A3', 'warm')

    expect(read(accent, '--flame-outer')).toBe(read(white, '--flame-outer'))
    expect(read(accent, '--flame-outer')).not.toBe(read(getCardStyle('accent', '#0051A3'), '--flame-outer'))
    expect(read(accent, '--flame-edge')).toBe('var(--card-on-accent)')
    expect(read(white, '--flame-edge')).toBe('var(--flame-outer)')
  })
})
