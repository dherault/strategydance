import { describe, expect, it } from 'bun:test'

import { normalizeRichText } from 'strategydance-design-system/lib/normalizeRichText'
import type { RichTextTableBlock, RichTextTextBlock } from 'strategydance-design-system/lib/richText'

// A block as BlockNote's editor hands it over, with its id and its default props
function editorBlock(
  type: string,
  content: unknown[] = [],
  props: Record<string, unknown> = {},
  children: unknown[] = [],
) {
  return {
    id: crypto.randomUUID(),
    type,
    props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left', ...props },
    content,
    children,
  }
}

function text(value: string, styles: Record<string, unknown> = {}) {
  return { type: 'text', text: value, styles }
}

describe('normalizeRichText', () => {
  it('keeps what the editor writes and drops its ids, default props and empty keys', () => {
    expect(
      normalizeRichText([
        editorBlock('heading', [text('Plan')], { level: 2 }),
        editorBlock('paragraph', [text('Ship '), text('it', { bold: true, italic: true })]),
        editorBlock('quote', [text('Small steps')]),
        editorBlock('bulletListItem', [text('One')], {}, [editorBlock('bulletListItem', [text('Nested')])]),
        editorBlock('numberedListItem', [text('Third')], { start: 3 }),
        editorBlock('checkListItem', [text('Done')], { checked: true }),
        editorBlock('checkListItem', [text('To do')], { checked: false }),
      ]),
    ).toEqual([
      { type: 'heading', content: [{ type: 'text', text: 'Plan' }] },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Ship ' },
          { type: 'text', text: 'it', styles: { bold: true, italic: true } },
        ],
      },
      { type: 'quote', content: [{ type: 'text', text: 'Small steps' }] },
      {
        type: 'bulletListItem',
        content: [{ type: 'text', text: 'One' }],
        children: [{ type: 'bulletListItem', content: [{ type: 'text', text: 'Nested' }] }],
      },
      { type: 'numberedListItem', props: { start: 3 }, content: [{ type: 'text', text: 'Third' }] },
      { type: 'checkListItem', props: { checked: true }, content: [{ type: 'text', text: 'Done' }] },
      { type: 'checkListItem', content: [{ type: 'text', text: 'To do' }] },
    ])
  })

  it('writes keys in one order, so the same document serializes to the same string', () => {
    const shuffled = { children: [], content: [{ styles: { bold: true }, text: 'a', type: 'text' }], type: 'paragraph' }

    expect(JSON.stringify(normalizeRichText([shuffled]))).toBe(
      '[{"type":"paragraph","content":[{"type":"text","text":"a","styles":{"bold":true}}]}]',
    )
  })

  it('keeps four styles, and only those that are on', () => {
    expect(
      normalizeRichText([
        editorBlock('paragraph', [
          text('a', {
            strike: true,
            underline: true,
            bold: false,
            textColor: 'red',
            code: true,
            backgroundColor: 'blue',
          }),
          text('b', { code: true }),
        ]),
      ]),
    ).toEqual([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'a', styles: { underline: true, strike: true } },
          { type: 'text', text: 'b' },
        ],
      },
    ])
  })

  it('keeps a web or mail link, as the URL parser writes it, and reads any other as its text', () => {
    const [block] = normalizeRichText([
      editorBlock('paragraph', [
        { type: 'link', href: 'HTTPS://Example.com', content: [text('site')] },
        { type: 'link', href: 'mailto:hi@example.com', content: 'mail' },
        { type: 'link', href: 'javascript:alert(1)', content: [text('script', { bold: true })] },
        { type: 'link', href: '/relative', content: [text('relative')] },
        { type: 'link', href: 'https://example.com/empty', content: [] },
      ]),
    ])

    expect((block as RichTextTextBlock | undefined)?.content).toEqual([
      { type: 'link', href: 'https://example.com/', content: [{ type: 'text', text: 'site' }] },
      { type: 'link', href: 'mailto:hi@example.com', content: [{ type: 'text', text: 'mail' }] },
      { type: 'text', text: 'script', styles: { bold: true } },
      { type: 'text', text: 'relative' },
    ])
  })

  it("keeps a heading's level but the second, and reads one past the third as the third", () => {
    expect(
      normalizeRichText([
        editorBlock('heading', [text('One')], { level: 1 }),
        editorBlock('heading', [text('Two')], { level: 2 }),
        editorBlock('heading', [text('Three')], { level: 3 }),
        editorBlock('heading', [text('Five')], { level: 5 }),
        editorBlock('heading', [text('Odd')], { level: 1.5 }),
        editorBlock('heading', [text('Zero')], { level: 0 }),
      ]),
    ).toEqual([
      { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'One' }] },
      { type: 'heading', content: [{ type: 'text', text: 'Two' }] },
      { type: 'heading', props: { level: 3 }, content: [{ type: 'text', text: 'Three' }] },
      { type: 'heading', props: { level: 3 }, content: [{ type: 'text', text: 'Five' }] },
      { type: 'heading', content: [{ type: 'text', text: 'Odd' }] },
      { type: 'heading', content: [{ type: 'text', text: 'Zero' }] },
    ])
  })

  it('makes a paragraph of a block it does not keep, and unwraps one holding no text', () => {
    expect(
      normalizeRichText(
        [
          editorBlock('heading', [text('Title')], { level: 1 }),
          editorBlock('codeBlock', [text('let a')], { language: 'ts' }),
          {
            type: 'image',
            props: { url: 'https://example.com/a.png' },
            children: [editorBlock('paragraph', [text('Under')])],
          },
          { type: 'table', content: { type: 'tableContent', rows: [] } },
        ],
        { blockTypes: ['paragraph', 'bulletListItem'] },
      ),
    ).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'Title' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'let a' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Under' }] },
    ])
  })

  it('keeps code as one run of its text, without styles, in a language it lists', () => {
    expect(
      normalizeRichText([
        editorBlock('codeBlock', [text('const a', { bold: true }), text(' = 1\n\tb()')], { language: 'typescript' }),
        editorBlock('codeBlock', [text('x')], { language: 'ts' }),
        editorBlock('codeBlock', [text('y')], { language: '' }),
        editorBlock('codeBlock', [text('z')], { language: 'cobol' }),
        editorBlock('codeBlock', [], { language: 'python' }),
        editorBlock('codeBlock', [text('w')], { language: 'text' }),
      ]),
    ).toEqual([
      { type: 'codeBlock', props: { language: 'typescript' }, content: [{ type: 'text', text: 'const a = 1\n\tb()' }] },
      { type: 'codeBlock', props: { language: 'typescript' }, content: [{ type: 'text', text: 'x' }] },
      { type: 'codeBlock', content: [{ type: 'text', text: 'y' }] },
      { type: 'codeBlock', content: [{ type: 'text', text: 'z' }] },
      { type: 'codeBlock', props: { language: 'python' } },
      { type: 'codeBlock', content: [{ type: 'text', text: 'w' }] },
    ])
  })

  it('reads a link inside code as its words, since code holds nothing but text', () => {
    expect(
      normalizeRichText([
        {
          type: 'codeBlock',
          content: [text('see '), { type: 'link', href: 'https://example.com', content: [text('docs')] }],
        },
      ]),
    ).toEqual([{ type: 'codeBlock', content: [{ type: 'text', text: 'see docs' }] }])
  })

  describe('keeps a table on its grid', () => {
    // A cell as BlockNote's editor hands it over, with every prop it carries
    function cell(content: unknown[], props: Record<string, unknown> = {}) {
      return {
        type: 'tableCell',
        content,
        props: {
          colspan: 1,
          rowspan: 1,
          backgroundColor: 'default',
          textColor: 'default',
          textAlignment: 'left',
          ...props,
        },
      }
    }

    function table(content: Record<string, unknown>) {
      return { ...editorBlock('table', [], {}), content: { type: 'tableContent', ...content } }
    }

    it('keeps its cells as their text, its widths and its header row', () => {
      expect(
        normalizeRichText([
          table({
            columnWidths: [180.4, undefined],
            headerRows: 1,
            rows: [
              { cells: [cell([text('Name', { bold: true })]), cell([text('Score')])] },
              { cells: [cell([text('Ada')]), cell([])] },
            ],
          }),
        ]),
      ).toEqual([
        {
          type: 'table',
          content: {
            type: 'tableContent',
            headerRows: 1,
            columnWidths: [180, null],
            rows: [
              {
                cells: [[{ type: 'text', text: 'Name', styles: { bold: true } }], [{ type: 'text', text: 'Score' }]],
              },
              { cells: [[{ type: 'text', text: 'Ada' }], []] },
            ],
          },
        },
      ])
    })

    it('reads cells written as their text, or as a string', () => {
      expect(normalizeRichText([table({ rows: [{ cells: [[text('a')], 'b'] }] })])[0]).toEqual({
        type: 'table',
        content: {
          type: 'tableContent',
          rows: [{ cells: [[{ type: 'text', text: 'a' }], [{ type: 'text', text: 'b' }]] }],
        },
      })
    })

    it('splits merged cells, so every cell keeps its column', () => {
      const rows = (
        normalizeRichText([
          table({
            rows: [
              { cells: [cell([text('a')], { colspan: 2 }), cell([text('b')], { rowspan: 2 })] },
              { cells: [cell([text('c')]), cell([text('d')])] },
              { cells: [cell([text('e')])] },
            ],
          }),
        ])[0] as RichTextTableBlock
      ).content.rows

      expect(rows.map(row => row.cells.map(cells => (cells[0] as { text?: string } | undefined)?.text ?? ''))).toEqual([
        ['a', '', 'b'],
        ['c', 'd', ''],
        ['e', '', ''],
      ])
    })

    it('says whether its first column is a header, but of a table of one header row', () => {
      const read = (content: Record<string, unknown>) =>
        (normalizeRichText([table(content)])[0] as RichTextTableBlock).content

      expect(read({ headerCols: 1, rows: [{ cells: ['a'] }, { cells: ['b'] }] }).headerCols).toBe(1)
      expect(read({ headerRows: 1, headerCols: 2, rows: [{ cells: ['a', 'b'] }] })).toMatchObject({ headerRows: 1 })
      expect(read({ headerRows: 1, headerCols: 2, rows: [{ cells: ['a', 'b'] }] }).headerCols).toBeUndefined()
      expect(read({ headerRows: 0, headerCols: '1', rows: [{ cells: ['a'] }] })).toEqual({
        type: 'tableContent',
        rows: [{ cells: [[{ type: 'text', text: 'a' }]] }],
      })
    })

    it('holds its widths within bounds, and leaves them out when none is set', () => {
      const read = (columnWidths: unknown) =>
        (normalizeRichText([table({ columnWidths, rows: [{ cells: ['a', 'b', 'c'] }] })])[0] as RichTextTableBlock)
          .content.columnWidths

      expect(read([10, 5000, 'wide'])).toEqual([35, 2000, null])
      expect(read([null, undefined])).toBeUndefined()
      expect(read('wide')).toBeUndefined()
    })

    it('keeps at most 25 columns and 200 rows, and drops a table without a cell for its children', () => {
      const wide = normalizeRichText([
        table({ rows: Array.from({ length: 250 }, () => ({ cells: Array(30).fill('x') })) }),
      ])
      const { rows } = (wide[0] as RichTextTableBlock).content

      expect(rows).toHaveLength(200)
      expect(rows[0].cells).toHaveLength(25)
      expect(
        normalizeRichText([
          { ...table({ rows: [{ cells: [] }] }), children: [editorBlock('paragraph', [text('Under')])] },
        ]),
      ).toEqual([{ type: 'paragraph', content: [{ type: 'text', text: 'Under' }] }])
    })
  })

  it("keeps a picture's web address, its text, its caption and its width, and nothing else", () => {
    expect(
      normalizeRichText([
        editorBlock('image', [], {
          url: 'https://example.com/a b.png',
          name: 'A chart',
          caption: 'Latency by week',
          previewWidth: 320.6,
          showPreview: true,
        }),
        editorBlock('image', [], { url: '', name: '', caption: '', previewWidth: undefined }),
        editorBlock('image', [], { url: 'javascript:alert(1)', caption: 'x'.repeat(1200), previewWidth: -4 }),
        editorBlock('image', [], { url: 'data:image/png;base64,AAAA', previewWidth: 9000 }),
      ]),
    ).toEqual([
      {
        type: 'image',
        props: { url: 'https://example.com/a%20b.png', name: 'A chart', caption: 'Latency by week', previewWidth: 321 },
      },
      { type: 'image' },
      { type: 'image', props: { caption: 'x'.repeat(1000) } },
      { type: 'image', props: { previewWidth: 2000 } },
    ])
  })

  it('keeps a video by the address of its page, written one way, or as the place one is about to go', () => {
    expect(
      normalizeRichText([
        editorBlock('videoEmbed', [], { url: 'https://youtu.be/aqz-KE-bpKQ?t=30' }),
        editorBlock('videoEmbed', [], { url: 'https://example.com/video.mp4' }),
        editorBlock('videoEmbed', [], { url: '' }),
      ]),
    ).toEqual([
      { type: 'videoEmbed', props: { url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=30s' } },
      { type: 'videoEmbed' },
      { type: 'videoEmbed' },
    ])
  })

  it("keeps a link preview's web address and what the page said, its picture at an https address only", () => {
    expect(
      normalizeRichText([
        editorBlock('linkPreview', [], {
          url: 'https://example.com/page',
          title: '  Indexes ',
          description: 'd'.repeat(1200),
          siteName: '',
          imageUrl: 'http://example.com/cover.png',
        }),
        editorBlock('linkPreview', [], { url: 'https://example.com/', imageUrl: 'https://example.com/cover.png' }),
        editorBlock('linkPreview', [], { url: 'javascript:alert(1)', title: 'Click' }),
        editorBlock('linkPreview', [], { url: '' }),
      ]),
    ).toEqual([
      {
        type: 'linkPreview',
        props: { url: 'https://example.com/page', title: 'Indexes', description: 'd'.repeat(1000) },
      },
      { type: 'linkPreview', props: { url: 'https://example.com/', imageUrl: 'https://example.com/cover.png' } },
      { type: 'linkPreview' },
      { type: 'linkPreview' },
    ])
  })

  it('keeps nothing that loads from elsewhere when told no media, a picture and a video giving way to their children', () => {
    expect(
      normalizeRichText(
        [
          // As BlockNote hands a block holding no text over, with no content
          {
            type: 'image',
            props: { url: 'https://example.com/a.png' },
            children: [editorBlock('paragraph', [text('Under')])],
          },
          { type: 'videoEmbed', props: { url: 'https://vimeo.com/76979871' }, children: [] },
          // Given content it never holds, by a writer other than BlockNote
          { type: 'image', props: { url: 'https://example.com/b.png' }, content: [text('alt')] },
          editorBlock('linkPreview', [], {
            url: 'https://example.com/',
            title: 'Example',
            imageUrl: 'https://example.com/cover.png',
          }),
        ],
        { media: false },
      ),
    ).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'Under' }] },
      { type: 'linkPreview', props: { url: 'https://example.com/', title: 'Example' } },
    ])
  })

  it('reads plain strings as text, and an unknown inline element as its text', () => {
    expect(
      normalizeRichText([{ type: 'paragraph', content: ['Hello ', { type: 'mention', content: [text('Ada')] }] }]),
    ).toEqual([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'Ada' },
        ],
      },
    ])
    expect(normalizeRichText([{ type: 'quote', content: 'Said' }])).toEqual([
      { type: 'quote', content: [{ type: 'text', text: 'Said' }] },
    ])
  })

  it('keeps a numbered start only when it is a whole number other than 1, or 0, which the editor numbers from 1', () => {
    const starts = [1, 0, 7, 2.5, '4'].map(
      start =>
        (normalizeRichText([editorBlock('numberedListItem', [text('a')], { start })])[0] as RichTextTextBlock).props,
    )

    expect(starts).toEqual([undefined, undefined, { start: 7 }, undefined, undefined])
  })

  it('drops the empty paragraphs a document ends on, and keeps those between blocks', () => {
    expect(
      normalizeRichText([
        editorBlock('paragraph', [text('a')]),
        editorBlock('paragraph'),
        editorBlock('paragraph', [text('b')]),
        editorBlock('paragraph'),
        editorBlock('paragraph', [text('')]),
      ]),
    ).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'a' }] },
      { type: 'paragraph' },
      { type: 'paragraph', content: [{ type: 'text', text: 'b' }] },
    ])
  })

  it('reads anything that is not a list of blocks as nothing, Lexical state included', () => {
    expect(normalizeRichText({ root: { type: 'root', children: [] } })).toEqual([])
    expect(normalizeRichText('text')).toEqual([])
    expect(normalizeRichText(null)).toEqual([])
    expect(normalizeRichText([null, 1, 'a', []])).toEqual([])
  })

  it('stops at a depth no hand indents to, rather than exhausting the stack', () => {
    let nested: unknown = editorBlock('bulletListItem', [text('deepest')])

    for (let level = 0; level < 10000; level += 1) nested = editorBlock('bulletListItem', [text('item')], {}, [nested])

    let depth = 0
    let [block] = normalizeRichText([nested])

    while (block?.children) {
      depth += 1
      ;[block] = block.children
    }

    expect(depth).toBe(31)
  })
})
