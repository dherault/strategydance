import { describe, expect, it } from 'bun:test'

import { createRichTextSchema, getRichTextBlockTypes } from 'strategydance-design-system/lib/richTextEditorSchema'

// The schema's blocks by name, which its type, built from the blocks asked for, leaves loose
function readBlockSchema(blocks: Parameters<typeof createRichTextSchema>[0]) {
  return createRichTextSchema(blocks).blockSchema as Record<string, { propSchema: Record<string, unknown> }>
}

describe('getRichTextBlockTypes', () => {
  it('names the stored blocks an editor writing some blocks keeps', () => {
    expect(getRichTextBlockTypes(['list', 'checklist'])).toEqual([
      'paragraph',
      'bulletListItem',
      'numberedListItem',
      'checkListItem',
    ])
    expect(getRichTextBlockTypes([])).toEqual(['paragraph'])
  })
})

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
})
