import { describe, expect, test } from 'bun:test'

import parseLinkPreviewHtml from './parseLinkPreviewHtml'

const PAGE = 'https://www.example.com/articles/indexes'

describe('parseLinkPreviewHtml', () => {
  test("reads a page's Open Graph tags, its entities decoded and its spaces folded", async () => {
    const html = `<!doctype html><html><head>
      <title>Ignored when Open Graph names one</title>
      <meta property="og:title" content="Caf&eacute; &amp;   indexes">
      <meta property="og:description" content="How two
        indexes halved the feed&#8217;s p95">
      <meta property="og:site_name" content="Example">
      <meta property="og:image" content="/images/cover.png">
    </head><body><p>Hi</p></body></html>`

    expect(await parseLinkPreviewHtml(html, PAGE)).toEqual({
      title: 'Café & indexes',
      description: 'How two indexes halved the feed’s p95',
      siteName: 'Example',
      imageUrl: 'https://www.example.com/images/cover.png',
    })
  })

  test("falls back on Twitter's tags, then on the page's title and description", async () => {
    expect(
      await parseLinkPreviewHtml(
        '<head><meta name="twitter:title" content="Twitter title"><meta name="twitter:image" content="https://cdn.example/a.jpg"><meta name="description" content="Plain description"></head>',
        PAGE,
      ),
    ).toEqual({ title: 'Twitter title', description: 'Plain description', imageUrl: 'https://cdn.example/a.jpg' })
    expect(await parseLinkPreviewHtml('<html><head><title> The page </title></head></html>', PAGE)).toEqual({
      title: 'The page',
    })
  })

  test("reads the head's title, never an icon's in the body, and the first tag of each name", async () => {
    expect(
      await parseLinkPreviewHtml(
        '<head><title>Head</title><meta property="og:site_name" content="First"><meta property="og:site_name" content="Second"></head><body><svg><title>Icon</title></svg></body>',
        PAGE,
      ),
    ).toEqual({ title: 'Head', siteName: 'First' })
  })

  test('keeps a picture only at an https address', async () => {
    for (const image of ['http://example.com/a.png', 'data:image/png;base64,AAAA', 'javascript:alert(1)']) {
      expect(await parseLinkPreviewHtml(`<meta property="og:image" content="${image}">`, PAGE)).toEqual({})
    }

    expect(
      await parseLinkPreviewHtml(
        '<meta property="og:image" content="http://example.com/a.png"><meta property="og:image:secure_url" content="https://example.com/a.png">',
        PAGE,
      ),
    ).toEqual({ imageUrl: 'https://example.com/a.png' })
  })

  test("holds each text to a card's length", async () => {
    const preview = await parseLinkPreviewHtml(
      `<meta property="og:title" content="${'t'.repeat(400)}"><meta property="og:description" content="${'d'.repeat(1200)}">`,
      PAGE,
    )

    expect(preview.title).toHaveLength(300)
    expect(preview.title).toEndWith('…')
    expect(preview.description).toHaveLength(1000)
  })

  test('reads nothing from a page that names nothing', async () => {
    expect(await parseLinkPreviewHtml('<p>Just text</p>', PAGE)).toEqual({})
    expect(await parseLinkPreviewHtml('', PAGE)).toEqual({})
  })
})
