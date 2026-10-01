import { describe, expect, it } from 'bun:test'

import { getRichTextText } from 'strategydance-design-system/lib/getRichTextText'

describe('getRichTextText', () => {
  it('reads each block and each nested block on a line of its own', () => {
    expect(
      getRichTextText([
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Ship ' },
            { type: 'text', text: 'it', styles: { bold: true } },
          ],
        },
        {
          type: 'bulletListItem',
          content: [{ type: 'text', text: 'One' }],
          children: [{ type: 'bulletListItem', content: [{ type: 'text', text: 'Two' }] }],
        },
        { type: 'paragraph' },
        {
          type: 'quote',
          content: [{ type: 'link', href: 'https://example.com/', content: [{ type: 'text', text: 'site' }] }],
        },
      ]),
    ).toBe('Ship it\nOne\nTwo\n\nsite')
  })

  it('reads no blocks as nothing', () => {
    expect(getRichTextText([])).toBe('')
  })
})
