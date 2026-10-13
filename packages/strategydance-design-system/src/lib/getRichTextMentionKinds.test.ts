import { describe, expect, it } from 'bun:test'

import { getRichTextMentionKinds } from 'strategydance-design-system/lib/getRichTextMentionKinds'

const DOCUMENT_ID = '0b6f2c4d8e9a4b1c9d2e3f4a5b6c7d8e'
const TASK_ID = '7a1b2c3d4e5f40718293a4b5c6d7e8f9'

describe('getRichTextMentionKinds', () => {
  it('says what some blocks mention, nested blocks and cells included, documents first', () => {
    expect(
      getRichTextMentionKinds([
        {
          type: 'table',
          content: {
            type: 'tableContent',
            rows: [{ cells: [[{ type: 'taskMention', props: { taskId: TASK_ID } }]] }],
          },
        },
        {
          type: 'bulletListItem',
          content: [{ type: 'text', text: 'One' }],
          children: [{ type: 'paragraph', content: [{ type: 'documentMention', props: { documentId: DOCUMENT_ID } }] }],
        },
      ]),
    ).toEqual(['document', 'task'])
  })

  it('says nothing for blocks that mention nothing', () => {
    expect(getRichTextMentionKinds([{ type: 'paragraph', content: [{ type: 'text', text: 'doc:' }] }])).toEqual([])
    expect(getRichTextMentionKinds([])).toEqual([])
  })
})
