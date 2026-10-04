import { describe, expect, it } from 'bun:test'

import { createRichTextYUpdate } from 'strategydance-design-system/lib/createRichTextYUpdate'
import { getHeadlessRichTextEditor } from 'strategydance-design-system/lib/getHeadlessRichTextEditor'
import { readRichTextYDoc } from 'strategydance-design-system/lib/readRichTextYDoc'
import {
  RICH_TEXT_YJS_FRAGMENT,
  type RichTextBlock,
  type RichTextInline,
} from 'strategydance-design-system/lib/richText'
import { RICH_TEXT_EDITOR_BLOCKS } from 'strategydance-design-system/lib/richTextEditorSchema'
import { type RichTextYDocEdit, updateRichTextYDoc } from 'strategydance-design-system/lib/updateRichTextYDoc'
import { initProseMirrorDoc } from 'y-prosemirror'
import * as Y from 'yjs'

function paragraph(...content: (string | RichTextInline)[]): RichTextBlock {
  return {
    type: 'paragraph',
    content: content.map(item => (typeof item === 'string' ? { type: 'text', text: item } : item)),
  }
}

function createDoc(blocks: RichTextBlock[]) {
  const doc = new Y.Doc()

  Y.applyUpdate(doc, createRichTextYUpdate(JSON.stringify(blocks)))

  return doc
}

// Another tab's copy of the document, as it stands
function fork(doc: Y.Doc) {
  const copy = new Y.Doc()

  Y.applyUpdate(copy, Y.encodeStateAsUpdate(doc))

  return copy
}

// Each copy given what the other has, as the server relays edits between tabs
function merge(ana: Y.Doc, ben: Y.Doc) {
  const fromAna = Y.encodeStateAsUpdate(ana, Y.encodeStateVector(ben))
  const fromBen = Y.encodeStateAsUpdate(ben, Y.encodeStateVector(ana))

  Y.applyUpdate(ana, fromBen)
  Y.applyUpdate(ben, fromAna)
}

function read(doc: Y.Doc) {
  return JSON.parse(readRichTextYDoc(doc).value)
}

// The top-level blocks of the shared text, as the elements Yjs keeps them in
function readContainers(doc: Y.Doc) {
  return (doc.getXmlFragment(RICH_TEXT_YJS_FRAGMENT).get(0) as Y.XmlElement).toArray() as Y.XmlElement[]
}

function readIds(doc: Y.Doc) {
  return readContainers(doc).map(container => container.getAttribute('id') as string)
}

// The text a block's content holds, where a writer types
function readText(container: Y.XmlElement, index = 0) {
  return (container.get(0) as Y.XmlElement).get(index) as Y.XmlText
}

// The first block nested under a block
function readChild(container: Y.XmlElement) {
  return (container.get(1) as Y.XmlElement).get(0) as Y.XmlElement
}

// Whether the shared text still reads as a document of the editor's schema
function isWellFormed(doc: Y.Doc) {
  const { doc: root } = initProseMirrorDoc(
    doc.getXmlFragment(RICH_TEXT_YJS_FRAGMENT),
    getHeadlessRichTextEditor(RICH_TEXT_EDITOR_BLOCKS).pmSchema,
  )

  root.check()

  return true
}

// What an edit sends: the updates the document emits, and the Yjs types its events reach
function watch(doc: Y.Doc) {
  const origins: unknown[] = []
  const targets: Y.AbstractType<unknown>[] = []

  doc.on('update', (_update: Uint8Array, origin: unknown) => origins.push(origin))
  doc.getXmlFragment(RICH_TEXT_YJS_FRAGMENT).observeDeep(events => {
    events.forEach(event => targets.push(event.target))
  })

  return { origins, targets }
}

function isWithin(type: Y.AbstractType<unknown>, ancestor: object) {
  for (
    let current: Y.AbstractType<unknown> | null = type;
    current;
    current = current.parent as Y.AbstractType<unknown>
  ) {
    if (current === ancestor) return true
  }

  return false
}

describe('updateRichTextYDoc', () => {
  it('merges a range replaced on one copy with typing in another block on the other', () => {
    const ana = createDoc([paragraph('Alpha'), paragraph('Bravo'), paragraph('Charlie'), paragraph('Delta')])
    const ben = fork(ana)
    const [, bravo, charlie] = readIds(ben)

    readText(readContainers(ana)[0]).insert(5, ' typed')

    expect(
      updateRichTextYDoc(ben, {
        type: 'replaceBlocks',
        fromId: bravo,
        toId: charlie,
        blocks: [paragraph('One'), paragraph('Two'), paragraph('Three')],
      }),
    ).toEqual({ outcome: 'updated' })

    merge(ana, ben)

    const expected = [
      paragraph('Alpha typed'),
      paragraph('One'),
      paragraph('Two'),
      paragraph('Three'),
      paragraph('Delta'),
    ]

    expect(Y.encodeStateVector(ana)).toEqual(Y.encodeStateVector(ben))
    expect(read(ana)).toEqual(expected)
    expect(read(ben)).toEqual(expected)
    expect(isWellFormed(ana)).toBe(true)
  })

  it('merges a replaced piece of text with typing elsewhere in the same block', () => {
    const ana = createDoc([paragraph('The plan is to ship in May')])
    const ben = fork(ana)

    readText(readContainers(ana)[0]).insert(0, 'Update: ')

    expect(updateRichTextYDoc(ben, { type: 'replaceText', find: 'in May', replace: 'in June' })).toEqual({
      outcome: 'updated',
    })

    merge(ana, ben)

    expect(read(ana)).toEqual([paragraph('Update: The plan is to ship in June')])
    expect(read(ben)).toEqual(read(ana))
  })

  describe('keeps every block outside the edit, and the positions in them', () => {
    const edits: [string, (ids: string[]) => RichTextYDocEdit][] = [
      [
        'a range replaced',
        ([, bravo]) => ({ type: 'replaceBlocks', fromId: bravo, toId: bravo, blocks: [paragraph('B')] }),
      ],
      ['blocks appended', () => ({ type: 'append', blocks: [paragraph('Foxtrot')] })],
      ['a piece of text replaced', () => ({ type: 'replaceText', find: 'Bravo', replace: 'Beta' })],
    ]

    for (const [name, createEdit] of edits) {
      it(`with ${name}`, () => {
        const doc = createDoc([
          paragraph('Alpha'),
          paragraph('Bravo'),
          { type: 'bulletListItem', content: [{ type: 'text', text: 'Charlie' }], children: [paragraph('Nested')] },
        ])
        const ids = readIds(doc)
        const [alpha, , charlie] = readContainers(doc)
        const nested = readChild(charlie)
        const positions = [readText(alpha), readText(charlie), readText(nested)].map(text => ({
          text,
          position: Y.createRelativePositionFromTypeIndex(text, 3),
        }))

        expect(updateRichTextYDoc(doc, createEdit(ids))).toEqual({ outcome: 'updated' })

        const containers = readContainers(doc)

        expect(containers[0]).toBe(alpha)
        expect(containers[2]).toBe(charlie)
        expect(readChild(containers[2])).toBe(nested)
        expect([containers[0], containers[2]].map(container => container.getAttribute('id'))).toEqual([ids[0], ids[2]])

        for (const { text, position } of positions) {
          const absolute = Y.createAbsolutePositionFromRelativePosition(position, doc)

          expect(absolute?.type).toBe(text)
          expect(absolute?.index).toBe(3)
        }
      })
    }

    it('with the text on both sides of a replaced piece of it', () => {
      const doc = createDoc([paragraph('Ship it in May, then rest')])
      const text = readText(readContainers(doc)[0])
      const before = Y.createRelativePositionFromTypeIndex(text, 5)
      const after = Y.createRelativePositionFromTypeIndex(text, 16)

      updateRichTextYDoc(doc, { type: 'replaceText', find: 'May', replace: 'June' })

      expect(text.toString()).toBe('Ship it in June, then rest')
      expect(Y.createAbsolutePositionFromRelativePosition(before, doc)?.index).toBe(5)
      expect(Y.createAbsolutePositionFromRelativePosition(after, doc)?.index).toBe(17)
    })
  })

  it('reads back an edit to a text seeded from its stored content', () => {
    const stored: RichTextBlock[] = [
      { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Pricing' }] },
      {
        type: 'bulletListItem',
        content: [
          { type: 'text', text: 'Charge ' },
          { type: 'text', text: 'monthly', styles: { bold: true, underline: true } },
        ],
      },
    ]
    const added: RichTextBlock = {
      type: 'checkListItem',
      props: { checked: true },
      content: [{ type: 'text', text: 'Decided' }],
    }
    const doc = createDoc(stored)

    updateRichTextYDoc(doc, { type: 'append', blocks: [added] })

    expect(readRichTextYDoc(doc).value).toBe(JSON.stringify([...stored, added]))
  })

  describe('keeps an untouched block that does not read back exactly', () => {
    const shapes: [string, (container: Y.XmlElement) => void][] = [
      ['a block somebody cleared', container => readText(container).delete(0, 4)],
      [
        'a block holding two texts',
        container => (container.get(0) as Y.XmlElement).insert(1, [new Y.XmlText(' more')]),
      ],
    ]
    const replacements: [string, RichTextBlock[]][] = [
      ['three blocks by one', [paragraph('One')]],
      ['one block by three', [paragraph('One'), paragraph('Two'), paragraph('Three')]],
    ]

    for (const [shape, prepare] of shapes) {
      for (const [replacement, blocks] of replacements) {
        it(`${shape}, with ${replacement}`, () => {
          const ana = createDoc([
            paragraph('Alpha'),
            paragraph('Bravo'),
            paragraph('Charlie'),
            paragraph('Delta'),
            paragraph('Echo'),
          ])

          prepare(readContainers(ana)[4])

          const ben = fork(ana)
          const [, bravo, , delta] = readIds(ben)
          const echo = readContainers(ben)[4]
          const echoId = echo.getAttribute('id')
          const toId = blocks.length === 1 ? delta : bravo

          readText(readContainers(ana)[4]).insert(0, 'typed ')

          expect(updateRichTextYDoc(ben, { type: 'replaceBlocks', fromId: bravo, toId, blocks })).toEqual({
            outcome: 'updated',
          })

          const containers = readContainers(ben)

          expect(containers.at(-1)).toBe(echo)
          expect(echo.getAttribute('id')).toBe(echoId)

          merge(ana, ben)

          expect(read(ben)).toEqual(read(ana))
          expect(read(ben).at(-1).content[0].text.startsWith('typed ')).toBe(true)
        })
      }
    }
  })

  it('drops what was typed meanwhile into the blocks it replaces, and nothing leaks into the new ones', () => {
    const ana = createDoc([paragraph('Alpha'), paragraph('Bravo'), paragraph('Charlie'), paragraph('Delta')])
    const ben = fork(ana)
    const [, bravo, , delta] = readIds(ben)
    const containers = readContainers(ana)

    readText(containers[1]).insert(0, 'typed ')
    readText(containers[2]).insert(0, 'typed ')

    updateRichTextYDoc(ben, { type: 'replaceBlocks', fromId: bravo, toId: delta, blocks: [paragraph('New')] })
    merge(ana, ben)

    expect(read(ana)).toEqual([paragraph('Alpha'), paragraph('New')])
    expect(read(ben)).toEqual(read(ana))
  })

  describe('writes the edit alone, in one update from its origin', () => {
    const origin = Symbol('agent')

    it('reaching only the group for blocks replaced', () => {
      const doc = createDoc([paragraph('Alpha'), paragraph('Bravo'), paragraph('Charlie')])
      const [, bravo] = readIds(doc)
      const { origins, targets } = watch(doc)

      updateRichTextYDoc(
        doc,
        { type: 'replaceBlocks', fromId: bravo, toId: bravo, blocks: [paragraph('B')] },
        { origin },
      )

      expect(origins).toEqual([origin])
      expect(targets.every(target => target === doc.getXmlFragment(RICH_TEXT_YJS_FRAGMENT).get(0))).toBe(true)
    })

    it('reaching only the edited block for a piece of text replaced', () => {
      const doc = createDoc([paragraph('Alpha'), paragraph('Bravo'), paragraph('Charlie')])
      const bravo = readContainers(doc)[1]
      const { origins, targets } = watch(doc)

      updateRichTextYDoc(doc, { type: 'replaceText', find: 'ravo', replace: 'eta' }, { origin })

      expect(origins).toEqual([origin])
      expect(targets.length).toBeGreaterThan(0)
      expect(targets.every(target => isWithin(target, bravo))).toBe(true)
    })
  })

  describe('refuses, touching nothing', () => {
    const cases: [string, () => Y.Doc, (doc: Y.Doc) => RichTextYDocEdit, object][] = [
      [
        'an id no top-level block has',
        () => createDoc([paragraph('Alpha')]),
        doc => ({ type: 'replaceBlocks', fromId: readIds(doc)[0], toId: 'gone', blocks: [] }),
        { outcome: 'blockNotFound', id: 'gone' },
      ],
      [
        'a nested block',
        () =>
          createDoc([
            { type: 'bulletListItem', content: [{ type: 'text', text: 'Top' }], children: [paragraph('Nested')] },
          ]),
        doc => {
          const id = readChild(readContainers(doc)[0]).getAttribute('id') as string

          return { type: 'replaceBlocks', fromId: id, toId: id, blocks: [] }
        },
        { outcome: 'blockNotFound' },
      ],
      [
        'an id two blocks share',
        () => {
          const doc = createDoc([paragraph('Alpha'), paragraph('Bravo')])
          const [alpha, bravo] = readContainers(doc)

          bravo.setAttribute('id', alpha.getAttribute('id') as string)

          return doc
        },
        doc => ({ type: 'replaceBlocks', fromId: readIds(doc)[0], toId: readIds(doc)[0], blocks: [] }),
        { outcome: 'blockNotUnique' },
      ],
      [
        'a range that starts after it ends',
        () => createDoc([paragraph('Alpha'), paragraph('Bravo')]),
        doc => ({ type: 'replaceBlocks', fromId: readIds(doc)[1], toId: readIds(doc)[0], blocks: [] }),
        { outcome: 'invalidRange' },
      ],
      [
        'a text found nowhere',
        () => createDoc([paragraph('Alpha')]),
        () => ({ type: 'replaceText', find: 'Omega', replace: 'Beta' }),
        { outcome: 'textNotFound' },
      ],
      [
        'an empty text',
        () => createDoc([paragraph('Alpha')]),
        () => ({ type: 'replaceText', find: '', replace: 'Beta' }),
        { outcome: 'textNotFound' },
      ],
      [
        'a text found twice',
        () => createDoc([paragraph('Plan A'), paragraph('Plan B')]),
        () => ({ type: 'replaceText', find: 'Plan', replace: 'Option' }),
        { outcome: 'textNotUnique', count: 2 },
      ],
      [
        'a text found twice through a nested block',
        () =>
          createDoc([
            { type: 'bulletListItem', content: [{ type: 'text', text: 'Plan' }], children: [paragraph('Plan B')] },
          ]),
        () => ({ type: 'replaceText', find: 'Plan', replace: 'Option' }),
        { outcome: 'textNotUnique', count: 2 },
      ],
      [
        'overlapping occurrences',
        () => createDoc([paragraph('aaa')]),
        () => ({ type: 'replaceText', find: 'aa', replace: 'b' }),
        { outcome: 'textNotUnique', count: 2 },
      ],
      [
        'a document holding known blocks out of place',
        () => {
          const doc = createDoc([paragraph('Alpha')])
          const misplaced = new Y.XmlElement('paragraph')

          misplaced.insert(0, [new Y.XmlText('Loose')])
          ;(doc.getXmlFragment(RICH_TEXT_YJS_FRAGMENT).get(0) as Y.XmlElement).insert(1, [misplaced])

          return doc
        },
        () => ({ type: 'append', blocks: [paragraph('Bravo')] }),
        { outcome: 'unknownContent' },
      ],
      [
        'a document holding a style the schema lacks',
        () => {
          const doc = createDoc([paragraph('Alpha')])

          readText(readContainers(doc)[0]).format(0, 2, { textColor: 'red' })

          return doc
        },
        () => ({ type: 'append', blocks: [paragraph('Bravo')] }),
        { outcome: 'unknownContent' },
      ],
      [
        'a document holding no text yet',
        () => new Y.Doc(),
        () => ({ type: 'append', blocks: [paragraph('Alpha')] }),
        { outcome: 'notSeeded' },
      ],
    ]

    for (const [name, createCase, createEdit, expected] of cases) {
      it(name, () => {
        const doc = createCase()
        const stateVector = Y.encodeStateVector(doc)
        const edit = createEdit(doc)
        const { origins } = watch(doc)

        expect(updateRichTextYDoc(doc, edit)).toMatchObject(expected)
        expect(Y.encodeStateVector(doc)).toEqual(stateVector)
        expect(origins).toEqual([])
      })
    }

    it('a document holding a block the schema lacks, which it leaves in place', () => {
      const doc = createDoc([{ type: 'heading', content: [{ type: 'text', text: 'Plan' }] }, paragraph('Alpha')])
      const stateVector = Y.encodeStateVector(doc)

      expect(updateRichTextYDoc(doc, { type: 'append', blocks: [paragraph('Bravo')] }, { blocks: [] })).toEqual({
        outcome: 'unknownContent',
      })
      expect(Y.encodeStateVector(doc)).toEqual(stateVector)
      expect(read(doc)[0].type).toBe('heading')
    })
  })

  describe('replaces a piece of text in the marks it starts in', () => {
    const cases: [string, RichTextBlock, string, string, RichTextBlock][] = [
      [
        'inside a bold run',
        paragraph('Make it ', { type: 'text', text: 'very bold', styles: { bold: true } }),
        'very',
        'quite',
        paragraph('Make it ', { type: 'text', text: 'quite bold', styles: { bold: true } }),
      ],
      [
        'right after a bold run, which it does not extend',
        paragraph({ type: 'text', text: 'Bold', styles: { bold: true } }, ' plain'),
        ' plain',
        ' text',
        paragraph({ type: 'text', text: 'Bold', styles: { bold: true } }, ' text'),
      ],
      [
        'inside a link',
        paragraph('See ', {
          type: 'link',
          href: 'https://example.com/',
          content: [{ type: 'text', text: 'the site' }],
        }),
        'site',
        'page',
        paragraph('See ', {
          type: 'link',
          href: 'https://example.com/',
          content: [{ type: 'text', text: 'the page' }],
        }),
      ],
      [
        "across a link's end",
        paragraph({ type: 'link', href: 'https://example.com/', content: [{ type: 'text', text: 'go here' }] }, ' now'),
        'here now',
        'there',
        paragraph({ type: 'link', href: 'https://example.com/', content: [{ type: 'text', text: 'go there' }] }),
      ],
      [
        'across a hard break',
        paragraph('line one\nline two'),
        'one\nline',
        'one, line',
        paragraph('line one, line two'),
      ],
      ['with line breaks of its own', paragraph('one line'), 'one line', 'two\nlines', paragraph('two\nlines')],
      ['beside an emoji', paragraph('👍🏽 done'), 'done', 'shipped', paragraph('👍🏽 shipped')],
      ['by nothing', paragraph('Remove this word'), ' this', '', paragraph('Remove word')],
    ]

    for (const [name, block, find, replace, expected] of cases) {
      it(name, () => {
        const doc = createDoc([block])

        expect(updateRichTextYDoc(doc, { type: 'replaceText', find, replace })).toEqual({ outcome: 'updated' })
        expect(read(doc)).toEqual([expected])
        expect(isWellFormed(doc)).toBe(true)
      })
    }
  })

  it('leaves one empty paragraph when every block is replaced by nothing', () => {
    const doc = createDoc([paragraph('Alpha'), paragraph('Bravo')])
    const [alpha, bravo] = readIds(doc)

    expect(updateRichTextYDoc(doc, { type: 'replaceBlocks', fromId: alpha, toId: bravo, blocks: [] })).toEqual({
      outcome: 'updated',
    })
    expect(readContainers(doc)).toHaveLength(1)
    expect(readRichTextYDoc(doc)).toEqual({ value: '[]', isEmpty: true })
    expect(isWellFormed(doc)).toBe(true)
  })
})
