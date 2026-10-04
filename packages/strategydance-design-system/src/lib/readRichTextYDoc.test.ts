import { describe, expect, it } from 'bun:test'

import { createRichTextYUpdate } from 'strategydance-design-system/lib/createRichTextYUpdate'
import { readRichTextYDoc } from 'strategydance-design-system/lib/readRichTextYDoc'
import { RICH_TEXT_YJS_FRAGMENT } from 'strategydance-design-system/lib/richText'
import * as Y from 'yjs'

function createDoc(value: string | null) {
  const doc = new Y.Doc()

  Y.applyUpdate(doc, createRichTextYUpdate(value))

  return doc
}

// The text node of the document's first block, where a writer types
function readFirstText(doc: Y.Doc) {
  let node: Y.XmlElement | Y.XmlText = doc.getXmlFragment(RICH_TEXT_YJS_FRAGMENT).get(0) as Y.XmlElement

  while (!(node instanceof Y.XmlText)) node = (node as Y.XmlElement).get(0) as Y.XmlElement | Y.XmlText

  return node
}

describe('readRichTextYDoc', () => {
  it('reads a shared document as the blocks it was laid in from', () => {
    const value = JSON.stringify([
      { type: 'heading', content: [{ type: 'text', text: 'Plan' }] },
      { type: 'bulletListItem', content: [{ type: 'text', text: 'Ship it' }] },
    ])

    expect(readRichTextYDoc(createDoc(value))).toEqual({ value, isEmpty: false })
  })

  it('reads a picture alone as saying something', () => {
    const value = JSON.stringify([{ type: 'image', props: { url: 'https://example.com/a.png', caption: 'A chart' } }])

    expect(readRichTextYDoc(createDoc(value))).toEqual({ value, isEmpty: false })
  })

  it('reads one empty paragraph as no text', () => {
    expect(readRichTextYDoc(createDoc(''))).toEqual({ value: '[]', isEmpty: true })
  })

  it('reads every edit merged in, whoever wrote it', () => {
    const value = JSON.stringify([{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }])
    const seed = createRichTextYUpdate(value)
    const ana = new Y.Doc()
    const ben = new Y.Doc()

    Y.applyUpdate(ana, seed)
    Y.applyUpdate(ben, seed)
    readFirstText(ana).insert(0, 'Ana: ')
    readFirstText(ben).insert(5, ' world')
    Y.applyUpdate(ana, Y.encodeStateAsUpdate(ben))

    expect(JSON.parse(readRichTextYDoc(ana).value)).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'Ana: Hello world' }] },
    ])
  })
})
