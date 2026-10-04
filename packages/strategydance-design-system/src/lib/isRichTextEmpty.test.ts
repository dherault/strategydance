import { describe, expect, it } from 'bun:test'

import { isRichTextEmpty } from 'strategydance-design-system/lib/isRichTextEmpty'

describe('isRichTextEmpty', () => {
  it('says blocks of blanks say nothing, as do empty code, an empty table and the place of a picture', () => {
    expect(isRichTextEmpty([])).toBe(true)
    expect(
      isRichTextEmpty([
        { type: 'paragraph', content: [{ type: 'text', text: '  ' }] },
        { type: 'codeBlock' },
        { type: 'table', content: { type: 'tableContent', rows: [{ cells: [[], []] }] } },
        { type: 'image' },
      ]),
    ).toBe(true)
  })

  it('says a picture says something, nested or not, as words do', () => {
    expect(isRichTextEmpty([{ type: 'image', props: { url: 'https://example.com/a.png' } }])).toBe(false)
    expect(
      isRichTextEmpty([
        { type: 'paragraph', children: [{ type: 'image', props: { url: 'https://example.com/a.png' } }] },
      ]),
    ).toBe(false)
    expect(isRichTextEmpty([{ type: 'codeBlock', content: [{ type: 'text', text: 'x' }] }])).toBe(false)
  })
})
