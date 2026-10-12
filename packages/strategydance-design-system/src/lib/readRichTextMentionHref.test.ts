import { describe, expect, it } from 'bun:test'

import { readRichTextMentionHref } from 'strategydance-design-system/lib/readRichTextMentionHref'

const ID = '0b6f2c4d8e9a4b1c9d2e3f4a5b6c7d8e'

describe('readRichTextMentionHref', () => {
  it('reads a link to a document or a task, whatever its case and its hyphens', () => {
    expect(readRichTextMentionHref(`doc:${ID}`)).toEqual({ kind: 'document', id: ID })
    expect(readRichTextMentionHref(`TASK:${ID.toUpperCase()}`)).toEqual({ kind: 'task', id: ID })
    expect(readRichTextMentionHref(' doc:0b6f2c4d-8e9a-4b1c-9d2e-3f4a5b6c7d8e ')).toEqual({ kind: 'document', id: ID })
  })

  it('reads any other address as naming nothing', () => {
    expect(readRichTextMentionHref('doc:123')).toBeNull()
    expect(readRichTextMentionHref(`doc:${ID}x`)).toBeNull()
    expect(readRichTextMentionHref(`doc:${ID.slice(0, 30)}----`)).toBeNull()
    expect(readRichTextMentionHref(`https://example.com/${ID}`)).toBeNull()
    expect(readRichTextMentionHref(`file:${ID}`)).toBeNull()
  })
})
