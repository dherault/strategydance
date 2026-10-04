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
})
