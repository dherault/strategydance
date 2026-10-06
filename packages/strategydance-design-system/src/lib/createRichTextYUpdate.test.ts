import { describe, expect, it } from 'bun:test'

import { BlockNoteEditor } from '@blocknote/core'
import { yDocToBlocks } from '@blocknote/core/yjs'
import { createRichTextYUpdate } from 'strategydance-design-system/lib/createRichTextYUpdate'
import { normalizeRichText } from 'strategydance-design-system/lib/normalizeRichText'
import { RICH_TEXT_EDITOR_BLOCKS, RICH_TEXT_YJS_FRAGMENT } from 'strategydance-design-system/lib/richText'
import { createRichTextSchema } from 'strategydance-design-system/lib/richTextEditorSchema'
import * as Y from 'yjs'

// The blocks a Yjs document holds, as BlockNote reads them
function readBlocks(update: Uint8Array) {
  const doc = new Y.Doc()

  Y.applyUpdate(doc, update)

  const editor = BlockNoteEditor.create({ schema: createRichTextSchema(RICH_TEXT_EDITOR_BLOCKS) })

  return yDocToBlocks(editor, doc, RICH_TEXT_YJS_FRAGMENT)
}

// The same, as `normalizeRichText` keeps them
function readUpdate(update: Uint8Array) {
  return normalizeRichText(readBlocks(update))
}

describe('createRichTextYUpdate', () => {
  it('lays stored blocks into a Yjs document, as they were', () => {
    const value = JSON.stringify([
      { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Plan' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Ship it', styles: { bold: true } }] },
      { type: 'checkListItem', props: { checked: true }, content: [{ type: 'text', text: 'Done' }] },
    ])

    expect(JSON.stringify(readUpdate(createRichTextYUpdate(value)))).toBe(value)
  })

  it('lays code in with its language and its line breaks', () => {
    const value = JSON.stringify([
      { type: 'codeBlock', props: { language: 'typescript' }, content: [{ type: 'text', text: 'const a = 1\n\tb()' }] },
      { type: 'codeBlock' },
    ])

    expect(JSON.stringify(readUpdate(createRichTextYUpdate(value)))).toBe(value)
  })

  it('lays a table in with its header row, its widths and its empty cells', () => {
    const value = JSON.stringify([
      {
        type: 'table',
        content: {
          type: 'tableContent',
          headerRows: 1,
          columnWidths: [150, null],
          rows: [
            { cells: [[{ type: 'text', text: 'Name' }], [{ type: 'text', text: 'Score' }]] },
            { cells: [[{ type: 'text', text: 'Ada', styles: { italic: true } }], []] },
          ],
        },
      },
    ])

    expect(JSON.stringify(readUpdate(createRichTextYUpdate(value)))).toBe(value)
  })

  it('lays pictures, videos and link previews in with their props', () => {
    const value = JSON.stringify([
      {
        type: 'image',
        props: { url: 'https://example.com/a.png', name: 'A chart', caption: 'Latency', previewWidth: 240 },
      },
      { type: 'videoEmbed', props: { url: 'https://vimeo.com/76979871' } },
      {
        type: 'linkPreview',
        props: {
          url: 'https://example.com/page',
          title: 'Indexes',
          description: 'How two indexes halved the feed',
          siteName: 'Example',
          imageUrl: 'https://example.com/cover.png',
        },
      },
    ])

    expect(JSON.stringify(readUpdate(createRichTextYUpdate(value)))).toBe(value)
  })

  it('lays an empty text in as one empty paragraph', () => {
    for (const value of ['', null]) {
      const blocks = readBlocks(createRichTextYUpdate(value))

      expect(blocks).toHaveLength(1)
      expect(blocks[0]).toMatchObject({ type: 'paragraph', content: [] })
    }
  })

  it('keeps only the blocks the editor writes', () => {
    const value = JSON.stringify([{ type: 'quote', content: [{ type: 'text', text: 'Hi' }] }])

    expect(readUpdate(createRichTextYUpdate(value, { blocks: [] }))).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] },
    ])
  })
})
