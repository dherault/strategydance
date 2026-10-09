import { describe, expect, it } from 'bun:test'

import { MAX_DOCUMENT_CONTENT_LENGTH } from 'strategydance-core'
import { markdownToRichText } from 'strategydance-design-system/lib/markdownToRichText'
import type {
  RichTextBlock,
  RichTextInline,
  RichTextRun,
  RichTextStyles,
} from 'strategydance-design-system/lib/richText'

function run(text: string, styles?: RichTextStyles): RichTextRun {
  return { type: 'text', text, ...(styles ? { styles } : {}) }
}

function paragraph(...content: (string | RichTextInline)[]): RichTextBlock {
  return { type: 'paragraph', content: content.map(item => (typeof item === 'string' ? run(item) : item)) }
}

describe('markdownToRichText', () => {
  it('reads nothing as no blocks', () => {
    expect(markdownToRichText('')).toEqual([])
    expect(markdownToRichText('\n\n  \n')).toEqual([])
  })

  describe('reads the four styles', () => {
    const cases: [string, string, RichTextBlock[]][] = [
      ['bold', 'a **b** c', [paragraph('a ', run('b', { bold: true }), ' c')]],
      ['italic', 'a *b* c', [paragraph('a ', run('b', { italic: true }), ' c')]],
      ['strikethrough', 'a ~~b~~ c', [paragraph('a ', run('b', { strike: true }), ' c')]],
      ['underline', 'a <u>b</u> c', [paragraph('a ', run('b', { underline: true }), ' c')]],
      ['underline in capitals', 'a <U>b</U> c', [paragraph('a ', run('b', { underline: true }), ' c')]],
      [
        'underline nested in bold',
        '**a <u>b</u>**',
        [paragraph(run('a ', { bold: true }), run('b', { bold: true, underline: true }))],
      ],
      [
        'bold nested in underline',
        '<u>a **b**</u>',
        [paragraph(run('a ', { underline: true }), run('b', { underline: true, bold: true }))],
      ],
      ['underline nested in itself', '<u>a <u>b</u> c</u> d', [paragraph(run('a b c', { underline: true }), ' d')]],
    ]

    for (const [name, markdown, expected] of cases) {
      it(name, () => expect(markdownToRichText(markdown)).toEqual(expected))
    }
  })

  describe('keeps any other tag as written', () => {
    const cases: [string, string, RichTextBlock[]][] = [
      ['another tag', 'a <b>b</b> c', [paragraph('a <b>b</b> c')]],
      ['a `<u>` never closed', 'a <u>b', [paragraph('a <u>b')]],
      ['a `</u>` never opened', 'a </u> b', [paragraph('a </u> b')]],
      ['a `<u>` closed only inside a style', '<u>a **b</u>**', [paragraph('<u>a ', run('b</u>', { bold: true }))]],
      ['a tag with attributes', '<u class="x">a</u>', [paragraph('<u class="x">a</u>')]],
      ['an HTML block', '<div>\nHello\n</div>', [paragraph('<div>\nHello\n</div>')]],
      ['a script', '<script>alert(1)</script>', [paragraph('<script>alert(1)</script>')]],
    ]

    for (const [name, markdown, expected] of cases) {
      it(name, () => expect(markdownToRichText(markdown)).toEqual(expected))
    }
  })

  it('breaks the line at a single newline, as the thread draws it', () => {
    expect(markdownToRichText('a\nb  \nc\\\nd')).toEqual([paragraph('a\nb\nc\nd')])
  })

  it('reads a single tilde as an estimate rather than a strikethrough', () => {
    expect(markdownToRichText('~5 minutes, ~10 at most')).toEqual([paragraph('~5 minutes, ~10 at most')])
  })

  it('reads headings at three levels, a deeper one as the third', () => {
    expect(markdownToRichText('# A\n\n## B\n\n### C\n\n#### D\n\n###### E')).toEqual([
      { type: 'heading', props: { level: 1 }, content: [run('A')] },
      { type: 'heading', content: [run('B')] },
      { type: 'heading', props: { level: 3 }, content: [run('C')] },
      { type: 'heading', props: { level: 3 }, content: [run('D')] },
      { type: 'heading', props: { level: 3 }, content: [run('E')] },
    ])
  })

  it('reads the paragraphs of a quote as quotes, and its other blocks as themselves', () => {
    expect(markdownToRichText('> A\n>\n> ## B\n>\n> - C')).toEqual([
      { type: 'quote', content: [run('A')] },
      { type: 'quote', content: [run('B')] },
      { type: 'bulletListItem', content: [run('C')] },
    ])
  })

  it('reads lists, numbered from their first number, and what is nested under their items', () => {
    expect(markdownToRichText('3. A\n4. B\n   - C\n\n     D\n- [ ] E\n- [x] F')).toEqual([
      { type: 'numberedListItem', props: { start: 3 }, content: [run('A')] },
      {
        type: 'numberedListItem',
        content: [run('B')],
        children: [{ type: 'bulletListItem', content: [run('C')], children: [paragraph('D')] }],
      },
      { type: 'checkListItem', content: [run('E')] },
      { type: 'checkListItem', props: { checked: true }, content: [run('F')] },
    ])
  })

  it('reads a list item that starts with something other than text as an empty item with it nested', () => {
    expect(markdownToRichText('- ```\n  x\n  ```')).toEqual([
      { type: 'bulletListItem', children: [{ type: 'codeBlock', content: [{ type: 'text', text: 'x' }] }] },
    ])
  })

  it('reads code with its language, by any name it is typed by', () => {
    expect(markdownToRichText('```ts\nconst a = 1\n```\n\n```\nplain\n```\n\n```klingon\nqapla\n```')).toEqual([
      { type: 'codeBlock', props: { language: 'typescript' }, content: [{ type: 'text', text: 'const a = 1' }] },
      { type: 'codeBlock', content: [{ type: 'text', text: 'plain' }] },
      { type: 'codeBlock', content: [{ type: 'text', text: 'qapla' }] },
    ])
  })

  it('reads a table with its header row, and one whose header row is empty without one', () => {
    expect(markdownToRichText('| A | **B** |\n| - | - |\n| c | d |\n\n| | |\n| - | - |\n| e | f |')).toEqual([
      {
        type: 'table',
        content: {
          type: 'tableContent',
          headerRows: 1,
          rows: [{ cells: [[run('A')], [run('B', { bold: true })]] }, { cells: [[run('c')], [run('d')]] }],
        },
      },
      { type: 'table', content: { type: 'tableContent', rows: [{ cells: [[run('e')], [run('f')]] }] } },
    ])
  })

  describe('reads links', () => {
    const cases: [string, string, RichTextBlock[]][] = [
      [
        'to the web, styled inside and out',
        '**[a *b*](https://example.com/x)**',
        [
          paragraph({
            type: 'link',
            href: 'https://example.com/x',
            content: [run('a ', { bold: true }), run('b', { bold: true, italic: true })],
          }),
        ],
      ],
      [
        'to a mail address',
        '[write](mailto:a@example.com)',
        [paragraph({ type: 'link', href: 'mailto:a@example.com', content: [run('write')] })],
      ],
      [
        'by reference',
        '[a][x]\n\n[x]: https://example.com/',
        [paragraph({ type: 'link', href: 'https://example.com/', content: [run('a')] })],
      ],
      [
        'written as a web address alone',
        'see https://example.com/',
        [paragraph('see ', { type: 'link', href: 'https://example.com/', content: [run('https://example.com/')] })],
      ],
      ['to a script, as written', '[a](javascript:alert(1))', [paragraph('[a](javascript:alert(1))')]],
      ['to a document, as its words', '[a](doc:123)', [paragraph('a')]],
    ]

    for (const [name, markdown, expected] of cases) {
      it(name, () => expect(markdownToRichText(markdown)).toEqual(expected))
    }
  })

  describe('degrades what rich text has no block or style for', () => {
    const cases: [string, string, RichTextBlock[]][] = [
      [
        'a picture, to a link to it with its alternative text',
        '![A cat](https://example.com/cat.png)',
        [paragraph({ type: 'link', href: 'https://example.com/cat.png', content: [run('A cat')] })],
      ],
      [
        'a picture inside a link, to its alternative text',
        '[![A cat](https://example.com/cat.png)](https://example.com/)',
        [paragraph({ type: 'link', href: 'https://example.com/', content: [run('A cat')] })],
      ],
      [
        'a picture from a script, as written',
        '![A cat](javascript:alert(1))',
        [paragraph('![A cat](javascript:alert(1))')],
      ],
      ['inline code, to its text', 'run `bun test` now', [paragraph('run bun test now')]],
      ['a rule, to nothing', 'a\n\n---\n\nb', [paragraph('a'), paragraph('b')]],
      ['a footnote, to its label, its note a link to nowhere', 'a[^1]\n\n[^1]: Note', [paragraph('a^1')]],
    ]

    for (const [name, markdown, expected] of cases) {
      it(name, () => expect(markdownToRichText(markdown)).toEqual(expected))
    }
  })

  /*
    Shapes micromark reads in time growing with the square of their length or worse, minutes or
    hours at the length of a document, and markdown-it in about a second at most. The timeout is
    generous, so a loaded machine does not fail it, and still far short of what micromark takes
  */
  describe('reads text an agent could be told to write, as long as a document may be, in bounded time', () => {
    const length = MAX_DOCUMENT_CONTENT_LENGTH
    const cases: [string, string][] = [
      ['closing brackets', ']a '.repeat(length / 3)],
      ['closing brackets among words', ']a word word word word word word word word word '.repeat(length / 51)],
      ['list markers on every line', '- - a\n'.repeat(length / 6)],
      ['list markers nested deep on every line', `${'- '.repeat(32)}a\n`.repeat(length / 66)],
      ['a list item on every line', '- a\n'.repeat(length / 4)],
      [
        'lists nested by indentation',
        `${Array.from({ length: 64 }, (_, index) => `${' '.repeat(2 * index)}- a`).join('\n')}\n`.repeat(45),
      ],
      ['one run of asterisks', `${'*'.repeat(length / 2)}a${'*'.repeat(length / 2)}`],
      ['asterisks between words', '2*3 '.repeat(length / 4)],
      [
        'runs of backticks of every length',
        Array.from({ length: 600 }, (_, index) => `${'`'.repeat(index + 1)}a`).join(' '),
      ],
      ['quotes nested deep', `${'>'.repeat(length)} a`],
      ['links never closed', '[a]('.repeat(length / 4)],
    ]

    for (const [name, markdown] of cases) {
      it(name, () => expect(Array.isArray(markdownToRichText(markdown))).toBe(true), 20000)
    }
  })
})
