import { describe, expect, test } from 'bun:test'
import type { AddressInfo } from 'node:net'
import { Readable } from 'node:stream'

import express from 'express'

import respondStoredFile from './respondStoredFile'

const FILE = { name: 'Receipt.txt', contentType: 'text/plain', size: 1000 }

// A server answering every request from the stream it is handed
async function serve(stream: Readable) {
  const app = express()

  app.get('/', (_request, response) => respondStoredFile(response, stream, FILE))

  const server = app.listen(0)

  await new Promise(resolve => server.once('listening', resolve))

  return { server, url: `http://localhost:${(server.address() as AddressInfo).port}/` }
}

describe('respondStoredFile', () => {
  test('destroys the bucket stream of a reader that goes away mid-file', async () => {
    // Some bytes, then nothing more, as a large file still streaming from the bucket
    const stream = new Readable({ read() {} })

    stream.push('Total ')

    const { server, url } = await serve(stream)
    const controller = new AbortController()
    const response = await fetch(url, { signal: controller.signal })
    const reader = response.body!.getReader()

    await reader.read()
    controller.abort()

    for (let attempt = 0; attempt < 50 && !stream.destroyed; attempt++) await Bun.sleep(20)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(stream.destroyed).toBe(true)
    server.close()
  })

  test('answers 404 for a file the bucket no longer holds, before any byte', async () => {
    const stream = new Readable({ read() {} })
    const { server, url } = await serve(stream)

    setTimeout(() => stream.destroy(new Error('No such object')), 10)

    const response = await fetch(url)

    expect(response.status).toBe(404)
    server.close()
  })
})
