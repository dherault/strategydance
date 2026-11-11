import { describe, expect, mock, test } from 'bun:test'

// Every message logged, whatever its level
const logged: string[] = []

mock.module('~utils/logger', () => ({
  default: {
    info: (message: string) => logged.push(message),
    warn: (message: string) => logged.push(message),
    error: (message: string) => logged.push(message),
  },
}))

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
      throw new OutboundRefusal('Not a public address: internal.example', 'privateAddress')
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

  test('logs the origin alone, never the path, the query nor what the server answered', async () => {
    const url = 'https://example.com/reset/a1b2c3?token=secret'
    const refused: Fetch = mock(async () => {
      throw new OutboundRefusal('Not a public address: https://example.com', 'privateAddress')
    })

    logged.length = 0

    for (const fetch of [answer(200, 'application/pdf', '%PDF'), answer(404, 'text/html', ''), refused]) {
      await readLinkPreview(url, fetch)
    }

    expect(logged).toHaveLength(3)

    for (const message of logged) {
      expect(message).toContain('https://example.com')
      expect(message).not.toMatch(/reset|token|secret|pdf/)
    }
  })

  test('names an address that is no web one as such, never by its text nor as null', async () => {
    const refused: Fetch = mock(async () => {
      throw new OutboundRefusal('Not a web address', 'address')
    })

    logged.length = 0

    for (const url of ['data:text/html,<p>secret</p>', 'not an address']) {
      expect(await readLinkPreview(url, refused)).toEqual({ url })
    }

    expect(logged).toEqual([
      'Link previews: could not read an address that is not a web one',
      'Link previews: could not read an address that is not a web one',
    ])
  })
})
