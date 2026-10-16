import { describe, expect, it } from 'bun:test'

import { defaultStyleSpecs } from '@blocknote/core'
import {
  RICH_TEXT_EDITOR_BLOCKS,
  RICH_TEXT_POST_BLOCKS,
  RICH_TEXT_TASK_BLOCKS,
} from 'strategydance-design-system/lib/richText'
import { createRichTextSchema } from 'strategydance-design-system/lib/richTextEditorSchema'

// The schema's blocks by name, which its type, built from the blocks asked for, leaves loose
function readBlockSchema(blocks: Parameters<typeof createRichTextSchema>[0]) {
  return createRichTextSchema(blocks).blockSchema as Record<string, { propSchema: Record<string, unknown> }>
}

describe('createRichTextSchema', () => {
  it('holds the blocks it is asked for, and paragraphs, without colors or alignment', () => {
    const { styleSchema, inlineContentSchema } = createRichTextSchema(['heading', 'checklist'])
    const blockSchema = readBlockSchema(['heading', 'checklist'])

    expect(Object.keys(blockSchema).sort()).toEqual(['checkListItem', 'heading', 'paragraph'])
    expect(Object.keys(blockSchema.heading.propSchema)).toEqual(['level'])
    expect(Object.keys(blockSchema.paragraph.propSchema)).toEqual([])
    expect(Object.keys(styleSchema).sort()).toEqual(['bold', 'code', 'italic', 'strike', 'underline'])
    expect(Object.keys(inlineContentSchema).sort()).toEqual(['link', 'text'])
  })

  it("holds mentions of documents and tasks in a document's text and a task's description, never a post's", () => {
    const inlineContent = (blocks: Parameters<typeof createRichTextSchema>[0]) =>
      createRichTextSchema(blocks).inlineContentSchema as unknown as Record<
        string,
        { propSchema: Record<string, unknown> }
      >

    expect(Object.keys(inlineContent(RICH_TEXT_POST_BLOCKS)).sort()).toEqual(['link', 'text'])

    for (const blocks of [RICH_TEXT_TASK_BLOCKS, RICH_TEXT_EDITOR_BLOCKS]) {
      const schema = inlineContent(blocks)

      expect(Object.keys(schema).sort()).toEqual(['documentMention', 'link', 'taskMention', 'text'])
      // Stored under these names for good, since a shared text holding a prop its schema lacks cannot be read
      expect(Object.keys(schema.documentMention.propSchema)).toEqual(['documentId', 'title'])
      expect(Object.keys(schema.taskMention.propSchema)).toEqual(['taskId', 'name'])
    }
  })

  it("writes inline code with BlockNote's own mark, whose rules turn text typed between backticks into code", () => {
    const { mark } = defaultStyleSpecs.code.implementation

    for (const blocks of [RICH_TEXT_POST_BLOCKS, RICH_TEXT_TASK_BLOCKS, RICH_TEXT_EDITOR_BLOCKS]) {
      const code = createRichTextSchema(blocks).styleSpecs.code.implementation.mark

      expect(code.name).toBe('code')
      expect(code.config.addInputRules).toBe(mark.config.addInputRules)
    }
  })

  it('writes three heading levels, the second by default', () => {
    expect(readBlockSchema(['heading']).heading.propSchema.level).toMatchObject({
      default: 2,
      values: [1, 2, 3],
    })
  })

  it("pastes a heading at its tag's level, and one past the third at the third", () => {
    const parse = createRichTextSchema(['heading']).blockSpecs.heading?.implementation.parse
    const read = (tagName: string) => parse?.({ tagName } as HTMLElement)

    expect(read('H1')).toEqual({ level: 1 })
    expect(read('H2')).toEqual({ level: 2 })
    expect(read('H3')).toEqual({ level: 3 })
    expect(read('H6')).toEqual({ level: 3 })
    expect(read('P')).toBeUndefined()
  })

  it('writes code in the languages it lists, plain text by default', () => {
    const blockSchema = readBlockSchema(['code'])

    expect(Object.keys(blockSchema).sort()).toEqual(['codeBlock', 'paragraph'])
    expect(blockSchema.codeBlock.propSchema.language).toMatchObject({ default: 'text' })
  })

  it("pastes code in a language it lists, read from the code's class", () => {
    const parse = createRichTextSchema(['code']).blockSpecs.codeBlock?.implementation.parse
    // The `<pre><code>` BlockNote reads a pasted block from, as much of it as it reads
    const read = (className: string) => {
      const code = { tagName: 'CODE', className, getAttribute: () => null }

      return parse?.({ tagName: 'PRE', childElementCount: 1, firstElementChild: code } as unknown as HTMLElement)
    }

    expect(read('language-ts')).toEqual({ language: 'typescript' })
    expect(read('language-cobol')).toEqual({ language: 'text' })
    expect(read('')).toEqual({ language: 'text' })
  })

  it('writes tables without colors', () => {
    const blockSchema = readBlockSchema(['table'])

    expect(Object.keys(blockSchema).sort()).toEqual(['paragraph', 'table'])
    expect(Object.keys(blockSchema.table.propSchema)).toEqual([])
  })

  it('writes pictures without colors or alignment', () => {
    const blockSchema = readBlockSchema(['image'])

    expect(Object.keys(blockSchema).sort()).toEqual(['image', 'paragraph'])
    expect(Object.keys(blockSchema.image.propSchema).sort()).toEqual([
      'caption',
      'name',
      'previewWidth',
      'showPreview',
      'url',
    ])
  })

  it("writes a video by its page's address, and reads a pasted player as one", () => {
    const schema = createRichTextSchema(['video'])
    const blockSchema = readBlockSchema(['video'])
    const parse = schema.blockSpecs.videoEmbed?.implementation.parse
    const frame = (src: string) => ({ tagName: 'IFRAME', getAttribute: () => src }) as unknown as HTMLElement

    expect(Object.keys(blockSchema).sort()).toEqual(['paragraph', 'videoEmbed'])
    expect(Object.keys(blockSchema.videoEmbed.propSchema)).toEqual(['url'])
    expect(parse?.(frame('https://www.youtube.com/embed/aqz-KE-bpKQ'))).toEqual({
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    })
    expect(parse?.(frame('https://evil.example/player'))).toBeUndefined()
  })

  it('writes a link preview with what the page said of itself', () => {
    const blockSchema = readBlockSchema(['linkPreview'])

    expect(Object.keys(blockSchema).sort()).toEqual(['linkPreview', 'paragraph'])
    expect(Object.keys(blockSchema.linkPreview.propSchema)).toEqual([
      'url',
      'title',
      'description',
      'siteName',
      'imageUrl',
    ])
  })
})
