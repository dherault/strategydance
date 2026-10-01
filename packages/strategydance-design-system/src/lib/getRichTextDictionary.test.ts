import { describe, expect, it } from 'bun:test'

import { getRichTextDictionary } from 'strategydance-design-system/lib/getRichTextDictionary'

describe('getRichTextDictionary', () => {
  it("speaks the app's locale, whatever its case", () => {
    expect(getRichTextDictionary('FR', { placeholder: 'Écrire' }).slash_menu.quote.title).toBe('Citation')
    expect(getRichTextDictionary('ja', { placeholder: '書く' }).slash_menu.quote.title).not.toBe('Quote')
  })

  it('speaks English for a locale BlockNote has no words for, or none', () => {
    expect(getRichTextDictionary('XX', { placeholder: 'Write' }).slash_menu.quote.title).toBe('Quote')
    expect(getRichTextDictionary(undefined, { placeholder: 'Write' }).slash_menu.quote.title).toBe('Quote')
  })

  it("lays the field's placeholder and heading name over BlockNote's, and keeps its '/' hint", () => {
    const dictionary = getRichTextDictionary('EN', { placeholder: 'What moved forward today?', heading: 'Heading' })

    expect(dictionary.placeholders.emptyDocument).toBe('What moved forward today?')
    expect(dictionary.placeholders.default).toContain('/')
    expect(dictionary.slash_menu.heading_2.title).toBe('Heading')
    expect(dictionary.slash_menu.heading_2.subtext).toBe(
      getRichTextDictionary('EN', { placeholder: '' }).slash_menu.heading_2.subtext,
    )
  })
})
