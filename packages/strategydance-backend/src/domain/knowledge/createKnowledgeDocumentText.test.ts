import { describe, expect, it } from 'bun:test'

import { MAX_DOCUMENT_CONTENT_LENGTH } from 'strategydance-core'
import { readRichTextYDoc } from 'strategydance-design-system/lib/readRichTextYDoc'
import * as Y from 'yjs'

import createKnowledgeDocumentText from '~domain/knowledge/createKnowledgeDocumentText'

describe('createKnowledgeDocumentText', () => {
  it('writes the first snapshot of a text, its content and its plain text', () => {
    const result = createKnowledgeDocumentText('# Plan\n\nShip *soon*, with ~~nothing~~ <u>left</u>.')

    if (result.outcome !== 'measured') throw new Error(result.outcome)

    const doc = new Y.Doc()

    Y.applyUpdate(doc, Buffer.from(result.state, 'base64'))

    expect(readRichTextYDoc(doc).value).toBe(result.content)
    expect(JSON.parse(result.content)).toEqual([
      { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Plan' }] },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Ship ' },
          { type: 'text', text: 'soon', styles: { italic: true } },
          { type: 'text', text: ', with ' },
          { type: 'text', text: 'nothing', styles: { strike: true } },
          { type: 'text', text: ' ' },
          { type: 'text', text: 'left', styles: { underline: true } },
          { type: 'text', text: '.' },
        ],
      },
    ])
    expect(result.contentText).toBe('Plan\nShip soon, with nothing left.')
  })

  it('writes an empty text as no content, its snapshot one empty paragraph', () => {
    const result = createKnowledgeDocumentText('')

    expect(result.outcome === 'measured' && [result.content, result.contentText]).toEqual(['', ''])
  })

  it('refuses a text longer than a document may be', () => {
    expect(createKnowledgeDocumentText('a'.repeat(MAX_DOCUMENT_CONTENT_LENGTH))).toEqual({ outcome: 'contentTooLong' })
  })
})
