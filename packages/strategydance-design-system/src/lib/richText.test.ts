import { describe, expect, it } from 'bun:test'

import { codeBlockOptions } from '@blocknote/code-block'
import {
  RICH_TEXT_CODE_LANGUAGES,
  getRichTextBlockTypes,
  getRichTextCodeLanguage,
} from 'strategydance-design-system/lib/richText'

describe('getRichTextBlockTypes', () => {
  it('names the stored blocks an editor writing some blocks keeps', () => {
    expect(getRichTextBlockTypes(['list', 'checklist'])).toEqual([
      'paragraph',
      'bulletListItem',
      'numberedListItem',
      'checkListItem',
    ])
    expect(getRichTextBlockTypes(['code'])).toEqual(['paragraph', 'codeBlock'])
    expect(getRichTextBlockTypes([])).toEqual(['paragraph'])
  })
})

describe('RICH_TEXT_CODE_LANGUAGES', () => {
  it('lists languages the highlighter bundles, under the names it knows them by', () => {
    const { supportedLanguages } = codeBlockOptions

    for (const [id, { name, aliases }] of Object.entries(RICH_TEXT_CODE_LANGUAGES)) {
      const bundled: { name: string; aliases?: string[] } | undefined =
        supportedLanguages[id as keyof typeof supportedLanguages]

      expect(bundled?.name).toBe(name)
      expect(bundled?.aliases).toEqual(aliases)
    }
  })
})

describe('getRichTextCodeLanguage', () => {
  it('reads a language by its id or another of its names, ignoring case and spaces', () => {
    expect(getRichTextCodeLanguage('typescript')).toBe('typescript')
    expect(getRichTextCodeLanguage('ts')).toBe('typescript')
    expect(getRichTextCodeLanguage(' Py ')).toBe('python')
    expect(getRichTextCodeLanguage('c++')).toBe('cpp')
    expect(getRichTextCodeLanguage('objc')).toBe('objective-c')
  })

  it('reads anything else as plain text, an empty name included', () => {
    expect(getRichTextCodeLanguage('')).toBe('text')
    expect(getRichTextCodeLanguage('brainfuck')).toBe('text')
    expect(getRichTextCodeLanguage(undefined)).toBe('text')
    expect(getRichTextCodeLanguage(42)).toBe('text')
  })
})
