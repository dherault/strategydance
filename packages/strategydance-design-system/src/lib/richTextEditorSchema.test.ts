import { describe, expect, it } from 'bun:test'

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
    expect(Object.keys(styleSchema).sort()).toEqual(['bold', 'italic', 'strike', 'underline'])
    expect(Object.keys(inlineContentSchema).sort()).toEqual(['link', 'text'])
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
})
