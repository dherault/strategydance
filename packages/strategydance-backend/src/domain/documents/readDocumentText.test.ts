import { describe, expect, it } from 'bun:test'

import { createRichTextYUpdate } from 'strategydance-design-system/lib/createRichTextYUpdate'
import { RICH_TEXT_YJS_FRAGMENT, type RichTextBlock } from 'strategydance-design-system/lib/richText'
import * as Y from 'yjs'

import readDocumentText from '~domain/documents/readDocumentText'
import seedDocumentText from '~domain/documents/seedDocumentText'

function paragraph(text: string): RichTextBlock {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}

function encode(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64')
}

function createState(blocks: RichTextBlock[]) {
  return encode(createRichTextYUpdate(JSON.stringify(blocks)))
}

// A tab's copy of the document, as it opened it from its snapshot
function open(state: string) {
  const doc = new Y.Doc()

  Y.applyUpdate(doc, Buffer.from(state, 'base64'))

  return doc
}

// What a tab pushes when it types into a top-level block: its edit as a pending update
function typeInto(doc: Y.Doc, index: number, offset: number, text: string) {
  const before = Y.encodeStateVector(doc)
  const container = (doc.getXmlFragment(RICH_TEXT_YJS_FRAGMENT).get(0) as Y.XmlElement).get(index) as Y.XmlElement

  ;((container.get(0) as Y.XmlElement).get(0) as Y.XmlText).insert(offset, text)

  return encode(Y.encodeStateAsUpdate(doc, before))
}

function readMarkdown(result: ReturnType<typeof readDocumentText>) {
  return result.outcome === 'read' ? result.blocks.map(block => block.markdown) : result
}

describe('readDocumentText', () => {
  it('reads each top-level block with its id and its Markdown', () => {
    const state = createState([
      { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Plan' }] },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Ship ' },
          { type: 'text', text: 'soon', styles: { bold: true, underline: true } },
        ],
      },
      { type: 'bulletListItem', content: [{ type: 'text', text: 'One' }], children: [paragraph('Under it')] },
    ])
    const result = readDocumentText({ state, updates: [] })

    expect(readMarkdown(result)).toEqual(['# Plan', 'Ship **<u>soon</u>**', '- One\n\n  Under it'])
    expect(result.outcome === 'read' && result.blocks.every(block => block.id.length > 0)).toBe(true)
  })

  it('hands out the same ids on every read of the same rows', () => {
    const text = { state: createState([paragraph('Alpha'), paragraph('Bravo')]), updates: [] }

    expect(readDocumentText(text)).toEqual(readDocumentText(text))
  })

  it('reads the snapshot with every pending update merged, as an open editor holds it', () => {
    const state = createState([paragraph('Alpha'), paragraph('Bravo')])
    const ana = open(state)
    const ben = open(state)
    const updates = [
      { id: 'update-1', payload: typeInto(ana, 0, 5, ' and more') },
      { id: 'update-2', payload: typeInto(ben, 1, 0, 'Then ') },
    ]
    const result = readDocumentText({ state, updates })
    const before = readDocumentText({ state, updates: [] })

    expect(readMarkdown(result)).toEqual(['Alpha and more', 'Then Bravo'])
    // Typing inside a block keeps its id
    expect(result.outcome === 'read' && result.blocks.map(block => block.id)).toEqual(
      before.outcome === 'read' && before.blocks.map(block => block.id),
    )
  })

  it('skips an update that cannot be merged, and reads the rest', () => {
    const state = createState([paragraph('Alpha')])
    const updates = [
      { id: 'broken', payload: encode(new Uint8Array([255, 255, 255, 255])) },
      { id: 'typed', payload: typeInto(open(state), 0, 5, '!') },
    ]

    expect(readMarkdown(readDocumentText({ state, updates }))).toEqual(['Alpha!'])
  })

  it('reads a document stored before its text was shared from its content, once seeded', () => {
    const content = JSON.stringify([paragraph('Stored before'), paragraph('the editor was shared')])
    const state = seedDocumentText(content)

    expect(readMarkdown(readDocumentText({ state, updates: [] }))).toEqual(['Stored before', 'the editor was shared'])
  })

  it('seeds an empty document with one empty paragraph, which an edit can name', () => {
    const result = readDocumentText({ state: seedDocumentText(''), updates: [] })

    expect(result.outcome === 'read' && result.blocks.map(block => block.markdown)).toEqual([''])
  })

  it('reads a numbered item with the number it shows, its place in its list', () => {
    const item = (text: string, start?: number): RichTextBlock => ({
      type: 'numberedListItem',
      ...(start ? { props: { start } } : {}),
      content: [{ type: 'text', text }],
    })
    const state = createState([
      item('A'),
      item('B'),
      item('C'),
      paragraph('Between'),
      item('D'),
      item('E', 7),
      item('F'),
    ])

    expect(readMarkdown(readDocumentText({ state, updates: [] }))).toEqual([
      '1. A',
      '2. B',
      '3. C',
      'Between',
      '1. D',
      '7. E',
      '8. F',
    ])
  })

  it('reads nothing of a snapshot that cannot be merged', () => {
    expect(readDocumentText({ state: encode(new Uint8Array([255, 255, 255, 255])), updates: [] })).toEqual({
      outcome: 'unreadableState',
    })
  })

  it('reads nothing of a text holding what this editor cannot read', () => {
    const doc = open(createState([paragraph('Alpha')]))
    const container = (doc.getXmlFragment(RICH_TEXT_YJS_FRAGMENT).get(0) as Y.XmlElement).get(0) as Y.XmlElement

    ;(container.get(0) as Y.XmlElement).setAttribute('textAlignment', 'center')

    expect(readDocumentText({ state: encode(Y.encodeStateAsUpdate(doc)), updates: [] })).toEqual({
      outcome: 'unknownContent',
    })
  })
})
