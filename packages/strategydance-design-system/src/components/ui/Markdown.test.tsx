import { describe, expect, it } from 'bun:test'

import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Markdown, type MarkdownLink } from 'strategydance-design-system/components/ui/Markdown'

function render(value: string, renderLink?: (link: MarkdownLink) => ReactNode) {
  return renderToStaticMarkup(
    <Markdown
      value={value}
      renderLink={renderLink}
    />,
  )
}

// Drops the class names, which other tests check, so a test reads the elements alone
function renderElements(value: string) {
  return render(value).replaceAll(/ class="[^"]*"/g, '')
}

const anchorAttributes = 'target="_blank" rel="noopener noreferrer nofollow"'

describe('Markdown', () => {
  it('draws paragraphs, both lists and the three styles', () => {
    const markup = renderElements(
      'One paragraph.\n\nTwo, with **bold**, *italic* and ~~struck~~ words.\n\n- a\n- b\n\n3. c\n4. d',
    )

    expect(markup).toContain('<p>One paragraph.</p>')
    expect(markup).toContain('<strong>bold</strong>, <em>italic</em> and <del>struck</del> words.')
    expect(markup).toContain('<ul>\n<li>a</li>\n<li>b</li>\n</ul>')
    expect(markup).toContain('<ol start="3">\n<li>c</li>\n<li>d</li>\n</ol>')
  })

  it('strikes only through two tildes, since one is how an estimate is written', () => {
    expect(renderElements('~5 to ~10 minutes')).toBe('<div><p>~5 to ~10 minutes</p></div>')
  })

  it('breaks the line at a single newline, as at a hard break', () => {
    expect(renderElements('**Revenue:** 266\n**Product:** live  \nNext')).toBe(
      '<div><p><strong>Revenue:</strong> 266<br/>\n<strong>Product:</strong> live<br/>\nNext</p></div>',
    )
  })

  it("draws a table through the design system's, its columns aligned as written", () => {
    const markup = render('| Part | Slides | Gap |\n|---|:-:|--:|\n| Founder problem | 2 to 4 | None |')

    expect(markup).toContain('data-slot="table-container"')
    expect(markup).toContain('data-density="sm"')
    expect(markup).toMatch(/<th data-slot="table-head" class="h-10 px-4 text-left [^"]*">Part<\/th>/)
    expect(markup).toMatch(/<th data-slot="table-head" class="[^"]* text-center">Slides<\/th>/)
    expect(markup).toMatch(/<td data-slot="table-cell" class="[^"]* text-right tabular-nums">None<\/td>/)
    expect(markup).not.toContain('style=')
  })

  it('draws every heading as a bold paragraph', () => {
    const markup = renderElements('# One\n\n## Two\n\n###### Six')

    expect(markup).toBe(
      '<div><p><strong>One</strong></p>\n<p><strong>Two</strong></p>\n<p><strong>Six</strong></p></div>',
    )
  })

  it('draws HTML as the text it is', () => {
    const markup = renderElements('<u>under</u> and <img src=x onerror=alert(1)>\n\n<script>alert(1)</script>')

    expect(markup).toContain('&lt;u&gt;under&lt;/u&gt; and &lt;img src=x onerror=alert(1)&gt;')
    expect(markup).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(markup).not.toContain('<u>')
    expect(markup).not.toContain('<img')
    expect(markup).not.toContain('<script')
  })

  it('links to web and mail addresses, in a new tab that is told nothing', () => {
    const markup = renderElements(
      '[site](https://example.com/a) [shout](HTTPS://Example.com/b) [mail](mailto:hi@example.com) www.example.com',
    )

    expect(markup).toContain(`<a href="https://example.com/a" ${anchorAttributes}>site</a>`)
    expect(markup).toContain(`<a href="https://example.com/b" ${anchorAttributes}>shout</a>`)
    expect(markup).toContain(`<a href="mailto:hi@example.com" ${anchorAttributes}>mail</a>`)
    expect(markup).toContain(`<a href="http://www.example.com/" ${anchorAttributes}>www.example.com</a>`)
  })

  it('draws a link to anything else as its words', () => {
    const markup = renderElements(
      '[a](javascript:alert(1)) [b](data:text/html,hi) [c](vbscript:x) [d](/today) [e](//evil.example) [f](#x)',
    )

    expect(markup).toBe('<div><p>a b c d e f</p></div>')
  })

  it('hands a link to a knowledge document to renderLink, and draws it as its words without one', () => {
    const links: MarkdownLink[] = []
    const markup = render('Read the [Pricing **options**](doc:d4).', link => {
      links.push(link)

      return <cite>{link.children}</cite>
    })

    expect(links.map(link => link.href)).toEqual(['doc:d4'])
    expect(markup).toContain('<cite>Pricing <strong class="font-semibold text-secondary">options</strong></cite>')
    expect(renderElements('Read the [Pricing options](doc:d4).')).toBe('<div><p>Read the Pricing options.</p></div>')
  })

  it('never loads an image, and keeps its alt text', () => {
    const markup = renderElements('![The chart](https://evil.example/pixel.png?q=secret)')

    expect(markup).toBe('<div><p>The chart</p></div>')
  })

  it('keeps the words of what falls outside the subset', () => {
    expect(renderElements('```\nfirst\nsecond\n```')).toBe('<div><p>first\nsecond\n</p></div>')
    expect(render('```\nfirst\n```')).toContain('<p class="mb-2 whitespace-pre-wrap">')
    expect(renderElements('> quoted')).toContain('<p>quoted</p>')
    expect(renderElements('Run `bun test`.')).toBe('<div><p>Run bun test.</p></div>')
    expect(renderElements('above\n\n---\n\nbelow')).toBe('<div><p>above</p>\n\n<p>below</p></div>')
    expect(renderElements('- [x] done')).not.toContain('<input')
  })

  it("is set at the dock's size or the page's", () => {
    expect(renderToStaticMarkup(<Markdown value="a" />)).toStartWith('<div class="text-base/[1.6] ')
    expect(
      renderToStaticMarkup(
        <Markdown
          value="a"
          size="sm"
        />,
      ),
    ).toStartWith('<div class="text-sm/[1.6] ')
  })

  describe('citations', () => {
    function renderCited(value: string, citations: { offset: number; key: string }[], withRenderer = true) {
      return renderToStaticMarkup(
        <Markdown
          value={value}
          citations={citations}
          renderCitation={withRenderer ? key => <sup>[{key}]</sup> : undefined}
        />,
      ).replaceAll(/ class="[^"]*"/g, '')
    }

    it('draws a marker right after the span it cites, inside the text', () => {
      expect(renderCited('Notion charges 10 per member, Coda 12.', [{ offset: 28, key: '1' }])).toBe(
        '<div><p>Notion charges 10 per member<sup>[1]</sup>, Coda 12.</p></div>',
      )
    })

    it('draws several markers each at its own offset', () => {
      expect(
        renderCited('Notion charges 10, Coda 12.', [
          { offset: 17, key: '1' },
          { offset: 26, key: '2' },
        ]),
      ).toBe('<div><p>Notion charges 10<sup>[1]</sup>, Coda 12<sup>[2]</sup>.</p></div>')
    })

    it('draws a marker in bold text, and after a link rather than inside it', () => {
      expect(renderCited('**Notion** is cheaper', [{ offset: 8, key: '1' }])).toBe(
        '<div><p><strong>Notion<sup>[1]</sup></strong> is cheaper</p></div>',
      )
      expect(renderCited('[Notion](https://notion.so) pricing', [{ offset: 5, key: '1' }])).toContain(
        'Notion</a><sup>[1]</sup> pricing',
      )
    })

    it('draws the markers of one offset together, in the order given, in text as after bold text', () => {
      const citations = [
        { offset: 17, key: '1' },
        { offset: 17, key: '2' },
      ]

      expect(renderCited('Notion charges 10, Coda 12.', citations)).toBe(
        '<div><p>Notion charges 10<sup>[1]</sup><sup>[2]</sup>, Coda 12.</p></div>',
      )
      expect(
        renderCited('Notion charges **10**, Coda 12.', [
          { offset: 21, key: '1' },
          { offset: 21, key: '2' },
        ]),
      ).toBe('<div><p>Notion charges <strong>10<sup>[1]</sup><sup>[2]</sup></strong>, Coda 12.</p></div>')
    })

    it('draws a marker between two blocks at the end of the first', () => {
      expect(renderCited('First paragraph.\n\nSecond.', [{ offset: 17, key: '1' }])).toBe(
        '<div><p>First paragraph.<sup>[1]</sup></p>\n<p>Second.</p></div>',
      )
    })

    it('draws a marker at its place in text whose source escapes, references or indents shortened', () => {
      expect(renderCited('A \\*star\\* here', [{ offset: 10, key: '1' }])).toBe(
        '<div><p>A *star*<sup>[1]</sup> here</p></div>',
      )
      expect(renderCited('Fish &amp; chips here', [{ offset: 16, key: '1' }])).toBe(
        '<div><p>Fish &amp; chips<sup>[1]</sup> here</p></div>',
      )
      expect(renderCited('First line\n    second line here', [{ offset: 26, key: '1' }])).toBe(
        '<div><p>First line<br/>\nsecond line<sup>[1]</sup> here</p></div>',
      )
    })

    it('draws nothing without a renderer, and keeps a footnote unwrapped', () => {
      expect(renderCited('Cited text.', [{ offset: 10, key: '1' }], false)).toBe('<div><p>Cited text.</p></div>')
      expect(renderElements('Text[^1]\n\n[^1]: A note')).not.toContain('<sup')
    })
  })
})
