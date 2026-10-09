import { describe, expect, it } from 'bun:test'

import { createRichTextYUpdate } from 'strategydance-design-system/lib/createRichTextYUpdate'
import { readRichTextYDocBlocks } from 'strategydance-design-system/lib/readRichTextYDocBlocks'
import { RICH_TEXT_YJS_FRAGMENT, type RichTextBlock } from 'strategydance-design-system/lib/richText'
import { updateRichTextYDoc } from 'strategydance-design-system/lib/updateRichTextYDoc'
import * as Y from 'yjs'

function paragraph(text: string): RichTextBlock {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}

function createDoc(blocks: RichTextBlock[]) {
  const doc = new Y.Doc()

  Y.applyUpdate(doc, createRichTextYUpdate(JSON.stringify(blocks)))

  return doc
}

// The top-level blocks of the shared text, as the elements Yjs keeps them in
function readContainers(doc: Y.Doc) {
  return (doc.getXmlFragment(RICH_TEXT_YJS_FRAGMENT).get(0) as Y.XmlElement).toArray() as Y.XmlElement[]
}

function readIds(doc: Y.Doc) {
  return readContainers(doc).map(container => container.getAttribute('id') as string)
}

describe('readRichTextYDocBlocks', () => {
  it('reads each top-level block with the id the shared text keeps it under', () => {
    const doc = createDoc([
      paragraph('Alpha'),
      { type: 'bulletListItem', content: [{ type: 'text', text: 'Bravo' }], children: [paragraph('Charlie')] },
    ])

    expect(readRichTextYDocBlocks(doc)).toEqual([
      { id: readIds(doc)[0], value: [paragraph('Alpha')] },
      {
        id: readIds(doc)[1],
        value: [
          { type: 'bulletListItem', content: [{ type: 'text', text: 'Bravo' }], children: [paragraph('Charlie')] },
        ],
      },
    ])
  })

  it('hands out the same ids on every read, and leaves the document as it was', () => {
    const doc = createDoc([paragraph('Alpha'), paragraph('Bravo')])
    const stateVector = Y.encodeStateVector(doc)
    const first = readRichTextYDocBlocks(doc)

    expect(readRichTextYDocBlocks(doc)).toEqual(first)
    expect(Y.encodeStateVector(doc)).toEqual(stateVector)
  })

  it('reads the ids an edit names its blocks by', () => {
    const doc = createDoc([paragraph('Alpha'), paragraph('Bravo'), paragraph('Charlie')])
    const [, bravo] = readRichTextYDocBlocks(doc) ?? []

    expect(
      updateRichTextYDoc(doc, {
        type: 'replaceBlocks',
        fromId: bravo.id,
        toId: bravo.id,
        blocks: [paragraph('Delta')],
      }),
    ).toEqual({ outcome: 'updated' })
    expect(readRichTextYDocBlocks(doc)?.map(block => block.value)).toEqual([
      [paragraph('Alpha')],
      [paragraph('Delta')],
      [paragraph('Charlie')],
    ])
  })

  it('keeps an empty paragraph as a block with its id, which stores as nothing', () => {
    const doc = createDoc([paragraph('Alpha'), { type: 'paragraph' }, paragraph('Bravo')])

    expect(readRichTextYDocBlocks(doc)).toEqual([
      { id: readIds(doc)[0], value: [paragraph('Alpha')] },
      { id: readIds(doc)[1], value: [] },
      { id: readIds(doc)[2], value: [paragraph('Bravo')] },
    ])
  })

  it('reads pictures, kept for a reader to see', () => {
    const doc = createDoc([{ type: 'image', props: { url: 'https://example.com/a.png', caption: 'A' } }])

    expect(readRichTextYDocBlocks(doc)?.[0].value).toEqual([
      { type: 'image', props: { url: 'https://example.com/a.png', caption: 'A' } },
    ])
  })

  it('reads nothing of a document holding a block the schema lacks, and leaves it as it was', () => {
    const doc = createDoc([{ type: 'heading', content: [{ type: 'text', text: 'Alpha' }] }, paragraph('Bravo')])
    const stateVector = Y.encodeStateVector(doc)

    expect(readRichTextYDocBlocks(doc, { blocks: [] })).toBeNull()
    expect(Y.encodeStateVector(doc)).toEqual(stateVector)
    expect(readRichTextYDocBlocks(doc)?.[0].value[0].type).toBe('heading')
  })

  it('reads nothing of a document holding a property the schema does not declare', () => {
    const doc = createDoc([paragraph('Alpha')])

    ;(readContainers(doc)[0].get(0) as Y.XmlElement).setAttribute('textAlignment', 'center')

    expect(readRichTextYDocBlocks(doc)).toBeNull()
  })

  it('reads nothing of a document holding no text yet, which a seed writes first', () => {
    expect(readRichTextYDocBlocks(new Y.Doc())).toBeNull()
  })
})
