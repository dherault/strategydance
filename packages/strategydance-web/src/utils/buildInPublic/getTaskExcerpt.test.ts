import { describe, expect, it } from 'bun:test'

import getTaskExcerpt from '~utils/buildInPublic/getTaskExcerpt'

function paragraph(text: string) {
  return { id: text, type: 'paragraph', props: {}, content: [{ type: 'text', text, styles: {} }], children: [] }
}

describe('getTaskExcerpt', () => {
  it("quotes a description's first paragraph that has words, on one line", () => {
    const description = JSON.stringify([
      {
        id: 'h',
        type: 'heading',
        props: { level: 2 },
        content: [{ type: 'text', text: 'Why', styles: {} }],
        children: [],
      },
      paragraph('  '),
      paragraph('Ship the launch\npage first.'),
      paragraph('Then the rest.'),
    ])

    expect(getTaskExcerpt(description)).toBe('Ship the launch page first.')
  })

  it('quotes nothing of a description of lists alone, of an empty one, or of one it cannot read', () => {
    const list = JSON.stringify([
      {
        id: 'l',
        type: 'bulletListItem',
        props: {},
        content: [{ type: 'text', text: 'A step', styles: {} }],
        children: [],
      },
    ])

    expect(getTaskExcerpt(list)).toBeNull()
    expect(getTaskExcerpt('')).toBeNull()
    expect(getTaskExcerpt('not blocks')).toBeNull()
  })
})
