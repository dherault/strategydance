import { describe, expect, it, spyOn } from 'bun:test'

import { renderToStaticMarkup } from 'react-dom/server'
import { RichText } from 'strategydance-design-system/components/ui/RichText'
import richTextSample from 'strategydance-design-system/components/ui/RichText.sample'
import { RICH_TEXT_EDITOR_BLOCKS } from 'strategydance-design-system/lib/richText'

function render(blocks: unknown) {
  return renderToStaticMarkup(<RichText value={JSON.stringify(blocks)} />)
}

// As a document draws its text, with every block its editor writes
function renderDocument(blocks: unknown) {
  return renderToStaticMarkup(
    <RichText
      value={JSON.stringify(blocks)}
      blocks={RICH_TEXT_EDITOR_BLOCKS}
    />,
  )
}

function text(value: string, styles: Record<string, unknown> = {}) {
  return { type: 'text', text: value, styles }
}

describe('RichText', () => {
  it('draws every block the editor writes', () => {
    const markup = renderToStaticMarkup(<RichText value={richTextSample} />)

    expect(markup).toContain('<p class="mb-2">Task feed p95')
    expect(markup).toContain('<span class="font-semibold">task_assignments</span>')
    expect(markup).toContain('<h1 ')
    expect(markup).toContain('<h2 ')
    expect(markup).toContain('<h3 ')
    expect(markup).toContain('<ul class="mb-2 pl-[22px] list-disc">')
    expect(markup).toContain('<ul class="mb-2 pl-[22px] list-[circle]">')
    expect(markup).toContain('<span class="italic">Remove the N+1 query')
    expect(markup).toContain('<ol start="3" ')
    expect(markup).toContain('<li data-checked="true" ')
    expect(markup).toContain('<blockquote ')
    expect(markup).toContain('morning.<br/>And the last')
  })

  it('draws the list items that follow each other as one list, each kind its own', () => {
    const markup = render([
      { type: 'bulletListItem', content: [text('a')] },
      { type: 'bulletListItem', content: [text('b')] },
      { type: 'numberedListItem', content: [text('c')] },
      { type: 'bulletListItem', content: [text('d')] },
    ])

    expect(markup.match(/<ul /g)).toHaveLength(2)
    expect(markup.match(/<ol /g)).toHaveLength(1)
    expect(markup.match(/<li /g)).toHaveLength(4)
  })

  it('numbers a list from its start, and says where to count from for a stylesheet that numbers it', () => {
    expect(render([{ type: 'numberedListItem', props: { start: 3 }, content: [text('c')] }])).toContain(
      '<ol start="3" style="--rich-text-list-reset:2"',
    )
    expect(render([{ type: 'numberedListItem', content: [text('a')] }])).toContain(
      '<ol style="--rich-text-list-reset:0"',
    )
  })

  it('draws a check item ticked or not, for the eye and for assistive technology', () => {
    const markup = render([
      { type: 'checkListItem', props: { checked: true }, content: [text('Done')] },
      { type: 'checkListItem', content: [text('To do')] },
    ])

    expect(markup).toContain('<input type="checkbox" disabled="" readOnly="" class="sr-only" checked=""/>')
    expect(markup).toContain('<input type="checkbox" disabled="" readOnly="" class="sr-only"/>')
    expect(markup).toContain('<span class="min-w-0 line-through opacity-60">Done</span>')
    expect(markup).toContain('<span class="min-w-0">To do</span>')
  })

  it('draws underline and strikethrough together rather than letting one win', () => {
    expect(render([{ type: 'paragraph', content: [text('both', { underline: true, strike: true })] }])).toContain(
      '[text-decoration-line:underline_line-through]',
    )
  })

  it('never applies a color, an alignment or a style a value carries', () => {
    const markup = render([
      {
        type: 'paragraph',
        props: { textColor: 'red', backgroundColor: 'blue', textAlignment: 'center' },
        content: [
          text('plain', { textColor: 'red', code: true }),
          { type: 'text', text: '!', style: 'position: fixed' },
        ],
      },
    ])

    expect(markup).toBe(
      '<div class="text-[15px] leading-[1.6] wrap-anywhere text-pretty text-secondary [&amp;&gt;:last-child]:mb-0 [&amp;:not(.descender-room_*)&gt;:is(h1,h2,h3):last-child]:pb-(--descender-room)"><p class="mb-2">plain!</p></div>',
    )
  })

  it('draws markup inside text as text', () => {
    expect(render([{ type: 'paragraph', content: [text('<img src=x onerror=alert(1)>')] }])).toContain(
      '&lt;img src=x onerror=alert(1)&gt;',
    )
  })

  it('links only to web and mail addresses, in a new tab that is told nothing', () => {
    const markup = render([
      {
        type: 'paragraph',
        content: [
          { type: 'link', href: 'https://example.com', content: [text('site')] },
          { type: 'link', href: 'javascript:alert(1)', content: [text(' script')] },
        ],
      },
    ])

    expect(markup).toContain(
      '<a href="https://example.com/" target="_blank" rel="noopener noreferrer nofollow" class="text-primary underline',
    )
    expect(markup).not.toContain('javascript')
    expect(markup).toContain(' script</p>')
  })

  it('draws a block a post does not hold as a paragraph, or as what it holds', () => {
    expect(
      render([
        { type: 'codeBlock', content: [text('let a')] },
        {
          type: 'image',
          props: { url: 'https://example.com/a.png' },
          children: [{ type: 'paragraph', content: [text('b')] }],
        },
      ]),
    ).toContain('<p class="mb-2">let a</p><p class="mb-2">b</p>')
  })

  it('draws code as its lines, in its language, where a document draws it', () => {
    const code = [{ type: 'codeBlock', props: { language: 'typescript' }, content: [text('let a = 1\n<b>bold</b>')] }]

    expect(renderDocument(code)).toContain(
      '<code data-language="typescript">let a = 1\n&lt;b&gt;bold&lt;/b&gt;</code></pre>',
    )
    expect(renderDocument([{ type: 'codeBlock' }])).toContain('<code data-language="text"></code>')
    expect(render(code)).toContain('<p class="mb-2">let a = 1<br/>&lt;b&gt;bold&lt;/b&gt;</p>')
  })

  it('draws a table with its header row and column, and its resized columns, where a document draws it', () => {
    const markup = renderDocument([
      {
        type: 'table',
        content: {
          type: 'tableContent',
          headerRows: 1,
          headerCols: 1,
          columnWidths: [200, null],
          rows: [
            { cells: [[text('Name')], [text('Score')]] },
            { cells: [[text('Ada')], [text('<b>9</b>', { bold: true })]] },
          ],
        },
      },
    ])

    expect(markup).toContain('<colgroup><col style="width:200px"/><col/></colgroup>')
    expect(markup).toContain(
      '<thead><tr><th scope="col" class="border border-neutral-200 px-2.5 py-1.5 text-left align-top bg-neutral-100 font-semibold">Name</th>',
    )
    expect(markup).toContain('min-w-[120px] bg-neutral-100 font-semibold">Score</th></tr></thead>')
    expect(markup).toContain('<tbody><tr><th scope="row" ')
    expect(markup).toContain('<span class="font-semibold">&lt;b&gt;9&lt;/b&gt;</span></td>')
    expect(render([{ type: 'table', content: { type: 'tableContent', rows: [{ cells: [[text('a')]] }] } }])).toBe('')
  })

  it("draws a heading at its level's tag, the second when it has none or one past the third", () => {
    expect(render([{ type: 'heading', props: { level: 1 }, content: [text('Title')] }])).toContain('<h1 ')
    expect(render([{ type: 'heading', content: [text('Title')] }])).toContain('<h2 ')
    expect(render([{ type: 'heading', props: { level: 3 }, content: [text('Title')] }])).toContain('<h3 ')
    expect(render([{ type: 'heading', props: { level: 5 }, content: [text('Title')] }])).toContain('<h3 ')
    expect(render([{ type: 'heading', props: { level: 'big' }, content: [text('Title')] }])).toContain('<h2 ')
  })

  it('draws what is nested under a block that is not a list item, indented', () => {
    expect(
      render([{ type: 'paragraph', content: [text('a')], children: [{ type: 'paragraph', content: [text('b')] }] }]),
    ).toContain('<p class="mb-2">a</p><div class="pl-6 [&amp;&gt;:last-child]:mb-0 mb-2"><p class="mb-2">b</p></div>')
  })

  it('stops walking past a depth no editor writes', () => {
    let block: Record<string, unknown> = { type: 'quote', content: [text('deep')] }

    for (let index = 0; index < 100; index++) block = { type: 'quote', content: [text('.')], children: [block] }

    expect(render([block])).not.toContain('deep')
  })

  it('draws nothing for an old Lexical value, nor for one that does not parse', () => {
    const consoleError = spyOn(console, 'error').mockImplementation(() => {})

    expect(renderToStaticMarkup(<RichText value="not json" />)).toBe('')
    expect(renderToStaticMarkup(<RichText value={JSON.stringify({ root: { type: 'root', children: [] } })} />)).toBe('')

    consoleError.mockRestore()
  })
})
