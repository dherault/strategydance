import { describe, expect, test } from 'bun:test'
import type { IncomingHttpHeaders } from 'node:http'

import fetchOutbound, { OutboundRefusal } from '~utils/fetchOutbound'

import probeDirectoryPage from '~domain/directories/probeDirectoryPage'

const URL = 'https://directory.example/'

const PAGE = `<html><head><title>A directory &amp; more</title><meta name="description" content="Find tools">
<script>window.app = {}</script><style>body{}</style></head>
<body><h1>Directory</h1><p>${'Submit your startup for free. '.repeat(20)}</p><script>track()</script>
<noscript>Enable JavaScript</noscript><svg/><p>FAQ: listings take a week.</p></body></html>`

type Answer = { status: number; headers?: IncomingHttpHeaders; body?: string; url?: string } | Error

function createFetch(answer: Answer): typeof fetchOutbound {
  return async url => {
    if (answer instanceof Error) throw answer

    return {
      url: answer.url ?? url,
      status: answer.status,
      headers: { 'content-type': 'text/html; charset=utf-8', ...answer.headers },
      body: Buffer.from(answer.body ?? ''),
      isTruncated: false,
    }
  }
}

function createError(code: string, message = code) {
  return Object.assign(new Error(message), { code })
}

async function probe(answer: Answer) {
  return probeDirectoryPage(URL, createFetch(answer))
}

describe('probeDirectoryPage', () => {
  test('reads a page as a reader sees it, scripts and styles left out', async () => {
    const result = await probe({ status: 200, body: PAGE, url: 'https://www.directory.example/' })

    expect(result).toMatchObject({
      url: URL,
      finalUrl: 'https://www.directory.example/',
      status: 200,
      outcome: 'reachable',
      failure: null,
      title: 'A directory & more',
      description: 'Find tools',
      isClientRendered: false,
    })
    expect(result.text.startsWith('Directory Submit your startup for free.')).toBe(true)
    expect(result.text.endsWith('FAQ: listings take a week.')).toBe(true)
    expect(result.text).not.toContain('track()')
    expect(result.text).not.toContain('Enable JavaScript')
    expect(result.text).not.toContain('window.app')
  })

  test('gives the pages of the same site it links to, and nothing else', async () => {
    const result = await probe({
      status: 200,
      url: 'https://www.directory.example/en/',
      body: `<a href="/pricing#plans">Pricing</a><a href="faq">FAQ</a><a href="https://directory.example/submit">Submit</a>
        <a href="https://other.example/">Elsewhere</a><a href="mailto:hi@directory.example">Mail</a><a href="/logo.png">Logo</a>
        <a href="/pricing">Pricing again</a><a href="#top">Top</a>`,
    })

    expect(result.links).toEqual([
      'https://www.directory.example/pricing',
      'https://www.directory.example/en/faq',
      'https://directory.example/submit',
    ])
  })

  test('takes a page with almost no text for one its scripts draw', async () => {
    const result = await probe({ status: 200, body: '<html><body><div id="root"></div></body></html>' })

    expect(result).toMatchObject({ outcome: 'reachable', isClientRendered: true })
  })

  test('reads no text from what is not a page', async () => {
    const result = await probe({ status: 200, headers: { 'content-type': 'application/json' }, body: '{}' })

    expect(result).toMatchObject({ outcome: 'reachable', text: '', isClientRendered: true })
  })

  test('tells a missing page, a bot wall and a server error apart', async () => {
    expect((await probe({ status: 404 })).outcome).toBe('missing')
    expect((await probe({ status: 410 })).outcome).toBe('missing')
    expect((await probe({ status: 403 })).outcome).toBe('blocked')
    expect((await probe({ status: 429 })).outcome).toBe('blocked')
    expect((await probe({ status: 503, headers: { 'cf-mitigated': 'challenge' } })).outcome).toBe('blocked')
    expect((await probe({ status: 503 })).outcome).toBe('unreachable')
    expect((await probe({ status: 522 })).outcome).toBe('unreachable')
    expect((await probe({ status: 400 })).outcome).toBe('unknown')
    expect((await probe({ status: 503 })).failure).toBe('HTTP 503')
  })

  test('takes a missing name, a dropped connection, a bad certificate and the deadline for no site', async () => {
    for (const error of [
      createError('ENOTFOUND'),
      createError('ECONNREFUSED'),
      createError('ECONNRESET', 'socket hang up'),
      createError('CERT_HAS_EXPIRED'),
      createError('ERR_TLS_CERT_ALTNAME_INVALID'),
      createError('DEPTH_ZERO_SELF_SIGNED_CERT'),
      Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
      new OutboundRefusal('Not a public address: directory.example', 'privateAddress'),
    ]) {
      expect((await probe(error)).outcome).toBe('unreachable')
    }
  })

  test('takes a redirect loop for a wall, and what it cannot tell for unknown', async () => {
    expect((await probe(new OutboundRefusal('More than 5 redirects', 'redirects'))).outcome).toBe('blocked')
    expect((await probe(new OutboundRefusal('Not a web port', 'port'))).outcome).toBe('unknown')
    expect((await probe(createError('EAI_AGAIN'))).outcome).toBe('unknown')
    expect(await probe(createError('EAI_AGAIN', 'try again'))).toMatchObject({
      finalUrl: null,
      status: null,
      failure: 'EAI_AGAIN: try again',
      isClientRendered: true,
    })
  })
})
