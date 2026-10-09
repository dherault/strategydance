import { describe, expect, it } from 'bun:test'

import { MAX_DOCUMENT_CONTENT_LENGTH } from 'strategydance-core'
import { markdownToRichText } from 'strategydance-design-system/lib/markdownToRichText'
import { normalizeRichText } from 'strategydance-design-system/lib/normalizeRichText'
import type {
  RichTextBlock,
  RichTextInline,
  RichTextRun,
  RichTextStyles,
} from 'strategydance-design-system/lib/richText'
import { richTextToMarkdown } from 'strategydance-design-system/lib/richTextToMarkdown'

const STYLES = ['bold', 'italic', 'underline', 'strike'] as const

function run(text: string, styles?: RichTextStyles): RichTextRun {
  return { type: 'text', text, ...(styles ? { styles } : {}) }
}

function paragraph(...content: (string | RichTextInline)[]): RichTextBlock {
  return { type: 'paragraph', content: content.map(item => (typeof item === 'string' ? run(item) : item)) }
}

// Every combination of the four styles, each on or off, at least one on
function combineStyles(): RichTextStyles[] {
  return Array.from({ length: 15 }, (_, index) =>
    Object.fromEntries(STYLES.filter((_, bit) => (index + 1) & (1 << bit)).map(style => [style, true])),
  )
}

function roundTrip(blocks: RichTextBlock[]) {
  return markdownToRichText(richTextToMarkdown(blocks))
}

describe('richTextToMarkdown', () => {
  it('writes no blocks as nothing', () => {
    expect(richTextToMarkdown([])).toBe('')
    expect(richTextToMarkdown([{ type: 'paragraph' }])).toBe('')
  })

  it('writes underline as the one tag, and text that looks like a tag escaped', () => {
    expect(richTextToMarkdown([paragraph('a ', run('b', { underline: true }), ' <u>c</u>')])).toBe(
      'a <u>b</u> \\<u>c\\</u>',
    )
  })

  it('writes a table without a header row under an empty one', () => {
    expect(
      richTextToMarkdown([
        { type: 'table', content: { type: 'tableContent', rows: [{ cells: [[run('a')], [run('b')]] }] } },
      ]),
    ).toBe('|   |   |\n| - | - |\n| a | b |')
  })

  it('writes a picture, a video and a link preview as links, and their placeholders as nothing', () => {
    expect(
      richTextToMarkdown([
        { type: 'image', props: { url: 'https://example.com/cat.png', caption: 'A cat' } },
        { type: 'image', props: { url: 'https://example.com/dog.png', name: 'dog.png' } },
        { type: 'videoEmbed', props: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } },
        { type: 'linkPreview', props: { url: 'https://example.com/', title: 'Example' } },
        { type: 'image' },
        { type: 'videoEmbed' },
        { type: 'linkPreview' },
      ]),
    ).toBe(
      [
        '[A cat](https://example.com/cat.png)',
        '[dog.png](https://example.com/dog.png)',
        '<https://www.youtube.com/watch?v=dQw4w9WgXcQ>',
        '[Example](https://example.com/)',
      ].join('\n\n'),
    )
  })

  it('writes what is nested under a block that is not a list item after it', () => {
    expect(richTextToMarkdown([{ ...paragraph('a'), children: [paragraph('b')] }])).toBe('a\n\nb')
  })

  describe('round trips', () => {
    describe('each combination of the four styles', () => {
      for (const styles of combineStyles()) {
        const name = Object.keys(styles).join(' and ')

        it(`${name}, inside a sentence`, () => {
          const blocks = [paragraph('a ', run('b', styles), ' c')]

          expect(roundTrip(blocks)).toEqual(blocks)
        })

        it(`${name}, against the words around it`, () => {
          const blocks = [paragraph('a', run('b', styles), 'c')]

          expect(roundTrip(blocks)).toEqual(blocks)
        })

        it(`${name}, as a whole paragraph`, () => {
          const blocks = [paragraph(run('a b', styles))]

          expect(roundTrip(blocks)).toEqual(blocks)
        })
      }
    })

    describe('neighbouring runs in different styles', () => {
      const cases: [string, RichTextInline[]][] = [
        [
          'bold, then bold and italic, then italic',
          [run('a', { bold: true }), run('b', { bold: true, italic: true }), run('c', { italic: true })],
        ],
        ['bold, then italic', [run('a', { bold: true }), run('b', { italic: true })]],
        ['italic, then bold', [run('a', { italic: true }), run('b', { bold: true })]],
        ['strikethrough, then underline', [run('a', { strike: true }), run('b', { underline: true })]],
        [
          'underline, then underline and bold, then bold',
          [run('a', { underline: true }), run('b', { underline: true, bold: true }), run('c', { bold: true })],
        ],
        [
          'each style, one after the other',
          [
            run('a', { bold: true }),
            run('b', { italic: true }),
            run('c', { underline: true }),
            run('d', { strike: true }),
          ],
        ],
        ['bold ending on a space, then plain', [run('a ', { bold: true }), run('b')]],
        ['plain, then italic starting on a space', [run('a'), run(' b', { italic: true })]],
        ['a style against punctuation', [run('('), run('a', { bold: true }), run(').')]],
      ]

      for (const [name, content] of cases) {
        it(name, () => {
          const blocks = [paragraph(...content)]

          expect(roundTrip(blocks)).toEqual(blocks)
        })
      }
    })

    describe('blocks', () => {
      const cases: [string, RichTextBlock[]][] = [
        [
          'headings at each level',
          [
            { type: 'heading', props: { level: 1 }, content: [run('A')] },
            { type: 'heading', content: [run('B')] },
            { type: 'heading', props: { level: 3 }, content: [run('C')] },
          ],
        ],
        [
          'quotes, one after the other',
          [
            { type: 'quote', content: [run('A '), run('b', { italic: true })] },
            { type: 'quote', content: [run('C')] },
          ],
        ],
        [
          'nested lists',
          [
            {
              type: 'bulletListItem',
              content: [run('A')],
              children: [
                {
                  type: 'numberedListItem',
                  content: [run('B')],
                  children: [{ type: 'bulletListItem', content: [run('C')] }],
                },
                { type: 'numberedListItem', content: [run('D')] },
              ],
            },
            { type: 'bulletListItem', content: [run('E')] },
          ],
        ],
        [
          'check items nested under check items',
          [
            {
              type: 'checkListItem',
              props: { checked: true },
              content: [run('A')],
              children: [{ type: 'checkListItem', content: [run('B')] }],
            },
            { type: 'checkListItem', content: [run('C')] },
          ],
        ],
        [
          'bulleted and check items in one list',
          [
            { type: 'bulletListItem', content: [run('A')] },
            { type: 'checkListItem', content: [run('B')] },
            { type: 'bulletListItem', content: [run('C')] },
          ],
        ],
        [
          'numbered lists with first numbers of their own',
          [
            { type: 'numberedListItem', props: { start: 3 }, content: [run('A')] },
            { type: 'numberedListItem', content: [run('B')] },
            { type: 'numberedListItem', props: { start: 7 }, content: [run('C')] },
          ],
        ],
        [
          'a list item with paragraphs nested under it',
          [{ type: 'bulletListItem', content: [run('A')], children: [paragraph('B'), paragraph('C')] }],
        ],
        [
          'code, with and without a language',
          [
            {
              type: 'codeBlock',
              props: { language: 'typescript' },
              content: [{ type: 'text', text: 'const a = `b`\n```' }],
            },
            { type: 'codeBlock', content: [{ type: 'text', text: '  indented\n\n\ttabbed' }] },
          ],
        ],
        [
          'tables, with and without a header row',
          [
            {
              type: 'table',
              content: {
                type: 'tableContent',
                headerRows: 1,
                rows: [
                  { cells: [[run('A', { bold: true })], [run('B | C')]] },
                  { cells: [[{ type: 'link', href: 'https://example.com/', content: [run('d')] }], []] },
                ],
              },
            },
            {
              type: 'table',
              content: {
                type: 'tableContent',
                rows: [{ cells: [[run('e')], [run('f')]] }, { cells: [[], [run('g')]] }],
              },
            },
          ],
        ],
        [
          'links, styled inside and out',
          [
            paragraph(
              run('a ', { bold: true }),
              { type: 'link', href: 'https://example.com/a?b=c&d=(e)', content: [run('b', { underline: true })] },
              { type: 'link', href: 'mailto:a@example.com', content: [run('c')] },
            ),
          ],
        ],
        ['line breaks inside a paragraph', [paragraph('a\nb\n\nc', run('\nd', { bold: true }))]],
        [
          'text that would read as Markdown',
          [
            paragraph('# not a heading'),
            paragraph('1. not a list'),
            paragraph('> not a quote'),
            paragraph('**not bold** and *not italic* and ~~not struck~~ and `not code`'),
            paragraph('<b>not a tag</b> and \\ a backslash and | a pipe and [not](a link) and ![not](a picture)'),
            paragraph('&amp; and &#169; as written'),
          ],
        ],
      ]

      for (const [name, blocks] of cases) {
        it(name, () => expect(roundTrip(blocks)).toEqual(normalizeRichText(blocks)))
      }
    })

    it(`a document as long as a document's content may be, ${MAX_DOCUMENT_CONTENT_LENGTH} characters`, () => {
      const section: RichTextBlock[] = [
        { type: 'heading', content: [run('A section')] },
        paragraph('Some ', run('bold', { bold: true }), ', some ', run('underlined', { underline: true }), ' words.'),
        {
          type: 'bulletListItem',
          content: [run('An item')],
          children: [{ type: 'checkListItem', content: [run('A task')] }],
        },
        { type: 'numberedListItem', content: [run('A step')] },
        { type: 'codeBlock', props: { language: 'typescript' }, content: [{ type: 'text', text: 'const a = 1' }] },
      ]
      const blocks: RichTextBlock[] = []

      while (JSON.stringify(blocks).length < MAX_DOCUMENT_CONTENT_LENGTH) blocks.push(...section)

      const markdown = richTextToMarkdown(blocks)

      expect(markdown.length).toBeLessThan(JSON.stringify(blocks).length)
      expect(markdownToRichText(markdown)).toEqual(blocks)
    })
  })

  it('writes deeply nested blocks without failing', () => {
    let block: RichTextBlock = { type: 'bulletListItem', content: [run('a')] }

    for (let depth = 0; depth < 5000; depth += 1)
      block = { type: 'bulletListItem', content: [run('a')], children: [block] }

    expect(() => richTextToMarkdown([block])).not.toThrow()
  })
})
