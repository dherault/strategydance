import { describe, expect, it } from 'bun:test'

import { BlockNoteEditor } from '@blocknote/core'
import { en } from '@blocknote/core/locales'
import { getRichTextDictionary } from 'strategydance-design-system/lib/getRichTextDictionary'
import { RICH_TEXT_EDITOR_BLOCKS } from 'strategydance-design-system/lib/richText'
import {
  getRichTextBlockTypeSelectItems,
  getRichTextSlashMenuItems,
} from 'strategydance-design-system/lib/richTextEditorMenus'
import { createRichTextSchema } from 'strategydance-design-system/lib/richTextEditorSchema'

describe('getRichTextBlockTypeSelectItems', () => {
  it('offers the three heading levels, without the toggle prop this heading lacks', () => {
    const headings = getRichTextBlockTypeSelectItems(en).filter(item => item.type === 'heading')

    expect(headings.map(item => [item.name, item.props])).toEqual([
      ['Heading 1', { level: 1 }],
      ['Heading 2', { level: 2 }],
      ['Heading 3', { level: 3 }],
    ])
  })

  it('offers code after the blocks of text, which BlockNote leaves out', () => {
    const last = getRichTextBlockTypeSelectItems(en).at(-1)

    expect([last?.name, last?.type, last?.props]).toEqual(['Code Block', 'codeBlock', undefined])
  })
})

describe('getRichTextSlashMenuItems', () => {
  // The menu's items for an editor writing `blocks`, by title and group, all of them as nothing is typed
  async function readItems(blocks: Parameters<typeof createRichTextSchema>[0]) {
    const editor = BlockNoteEditor.create({
      schema: createRichTextSchema(blocks),
      dictionary: getRichTextDictionary('EN', { placeholder: 'Write' }),
    })
    const items = await getRichTextSlashMenuItems(editor)('')

    return items.map(item => `${item.group}: ${item.title}`)
  }

  it("offers the blocks a document's editor writes, its video after BlockNote's picture", async () => {
    expect(await readItems(RICH_TEXT_EDITOR_BLOCKS)).toEqual([
      'Headings: Heading 1',
      'Headings: Heading 2',
      'Headings: Heading 3',
      'Basic blocks: Quote',
      'Basic blocks: Numbered List',
      'Basic blocks: Bullet List',
      'Basic blocks: Check List',
      'Basic blocks: Paragraph',
      'Basic blocks: Code Block',
      'Advanced: Table',
      'Media: Image',
      'Media: Video',
    ])
  })

  it('offers no video to an editor that writes none', async () => {
    expect(await readItems(['heading'])).not.toContain('Media: Video')
  })
})
