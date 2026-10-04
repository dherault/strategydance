import { describe, expect, it } from 'bun:test'

import { normalizeRichText } from 'strategydance-design-system/lib/normalizeRichText'

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

    expect(block?.content).toEqual([
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
      start => normalizeRichText([editorBlock('numberedListItem', [text('a')], { start })])[0]?.props,
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
