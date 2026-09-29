import { describe, expect, it } from 'bun:test'

import { renderToStaticMarkup } from 'react-dom/server'
import { RichText } from 'strategydance-design-system/components/ui/RichText'
import richTextSample from 'strategydance-design-system/components/ui/RichText.sample'

function render(root: unknown) {
  return renderToStaticMarkup(<RichText value={JSON.stringify({ root })} />)
}

function text(value: string, format = 0, extra: Record<string, unknown> = {}) {
  return { type: 'text', text: value, format, ...extra }
}

describe('RichText', () => {
  it('draws every node the editor writes', () => {
    const markup = renderToStaticMarkup(<RichText value={richTextSample} />)

    expect(markup).toContain('<p class="mb-2">Task feed p95')
    expect(markup).toContain('<span class="font-semibold">task_assignments</span>')
    expect(markup).toContain('<h2 ')
    expect(markup).toContain('<ul class="mb-2 list-disc')
    expect(markup).toContain('<span class="italic">Remove the N+1 query')
    expect(markup).toContain('<blockquote ')
  })

  it('draws underline and strikethrough together rather than letting one win', () => {
    expect(render({ type: 'root', children: [{ type: 'paragraph', children: [text('both', 12)] }] })).toContain(
      '[text-decoration-line:underline_line-through]',
    )
  })

  it('never applies a style a value carries', () => {
    const markup = render({
      type: 'root',
      children: [{ type: 'paragraph', children: [text('plain', 0, { style: 'position: fixed' })] }],
    })

    expect(markup).not.toContain('style')
    expect(markup).toContain('plain')
  })

  it('draws markup inside text as text', () => {
    expect(
      render({ type: 'root', children: [{ type: 'paragraph', children: [text('<img src=x onerror=alert(1)>')] }] }),
    ).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('unwraps an element it does not know, and drops anything else', () => {
    const markup = render({
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'link', url: 'javascript:alert(1)', children: [text('words')] },
            { type: 'image', src: 'x' },
          ],
        },
      ],
    })

    expect(markup).toBe(
      '<div class="text-[15px] leading-[1.6] wrap-anywhere text-pretty text-secondary [&amp;&gt;:last-child]:mb-0"><p class="mb-2">words</p></div>',
    )
  })

  it('draws any heading at the one level', () => {
    expect(render({ type: 'root', children: [{ type: 'heading', tag: 'h1', children: [text('Title')] }] })).toContain(
      '<h2 ',
    )
  })

  it('stops walking past a depth no editor writes', () => {
    let node: Record<string, unknown> = text('deep')

    for (let index = 0; index < 100; index++) node = { type: 'quote', children: [node] }

    expect(render({ type: 'root', children: [node] })).not.toContain('deep')
  })

  it('draws nothing for a value that does not parse', () => {
    const consoleError = console.error
    console.error = () => {}

    try {
      expect(renderToStaticMarkup(<RichText value="not json" />)).toBe('')
      expect(renderToStaticMarkup(<RichText value={JSON.stringify({ root: { type: 'paragraph' } })} />)).toBe('')
    } finally {
      console.error = consoleError
    }
  })
})
