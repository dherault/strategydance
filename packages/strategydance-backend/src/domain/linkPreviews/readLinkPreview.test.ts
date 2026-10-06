import { describe, expect, mock, test } from 'bun:test'

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

const { default: readLinkPreview } = await import('./readLinkPreview')
const { OutboundRefusal } = await import('~utils/fetchOutbound')

type Fetch = NonNullable<Parameters<typeof readLinkPreview>[1]>

// A fetch answering one response, as `fetchOutbound` would after its redirects
function answer(
  status: number,
  contentType: string | undefined,
  html: string,
  url = 'https://example.com/page',
): Fetch {
  return mock(async () => ({
    url,
    status,
    headers: contentType ? { 'content-type': contentType } : {},
    body: Buffer.from(html),
    isTruncated: false,
  }))
}

describe('readLinkPreview', () => {
  test('reads the page the address answers with, resolving its picture against where it ended up', async () => {
    const fetch = answer(
      200,
      'text/html; charset=utf-8',
      '<head><title>Indexes</title><meta property="og:image" content="cover.png"></head>',
      'https://www.example.com/articles/',
    )

    expect(await readLinkPreview('http://example.com/a', fetch)).toEqual({
      url: 'http://example.com/a',
      title: 'Indexes',
      imageUrl: 'https://www.example.com/articles/cover.png',
    })
    expect(fetch).toHaveBeenCalledWith(
      'http://example.com/a',
      expect.objectContaining({
        maxRedirects: 5,
        headers: expect.objectContaining({ accept: 'text/html,application/xhtml+xml' }),
      }),
    )
  })

  test('answers the address alone for what is not a page, an error status, or a refused address', async () => {
    const refused: Fetch = mock(async () => {
      throw new OutboundRefusal('Not a public address: internal.example')
    })

    for (const fetch of [
      answer(200, 'application/pdf', '%PDF'),
      answer(200, undefined, '<title>No type</title>'),
      answer(404, 'text/html', '<title>Not found</title>'),
      refused,
    ]) {
      expect(await readLinkPreview('https://example.com/file', fetch)).toEqual({ url: 'https://example.com/file' })
    }
  })
})
