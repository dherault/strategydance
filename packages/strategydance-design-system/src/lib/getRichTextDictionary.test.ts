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

  it('adds the block menu\'s "Turn into", in English unless the caller names it', () => {
    expect(getRichTextDictionary('FR', { placeholder: 'Écrire' }).drag_handle.turn_into_menuitem).toBe('Turn into')
    expect(
      getRichTextDictionary('FR', { placeholder: 'Écrire', turnInto: 'Transformer en' }).drag_handle.turn_into_menuitem,
    ).toBe('Transformer en')
    expect(getRichTextDictionary('FR', { placeholder: 'Écrire' }).drag_handle.delete_menuitem).toBe('Supprimer')
  })

  it("lays the field's placeholder over BlockNote's, and keeps its '/' hint", () => {
    const dictionary = getRichTextDictionary('EN', { placeholder: 'What moved forward today?' })

    expect(dictionary.placeholders.emptyDocument).toBe('What moved forward today?')
    expect(dictionary.placeholders.default).toContain('/')
  })
})
