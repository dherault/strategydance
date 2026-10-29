import { describe, expect, test } from 'bun:test'
import type { AddressInfo } from 'node:net'
import { Readable } from 'node:stream'

import express, { type Response } from 'express'

import respondStoredFile from './respondStoredFile'

const FILE = { name: 'Receipt.txt', contentType: 'text/plain', size: 1000 }

// A server answering every request from the stream it is handed, once the route's lookup is over
async function serve(stream: Readable, lookup: (response: Response) => Promise<unknown> = async () => {}) {
  const app = express()

  app.get('/', async (_request, response) => {
    await lookup(response)
    respondStoredFile(response, stream, FILE)
  })

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

  test('destroys the bucket stream of a reader gone while the route looked the file up', async () => {
    const stream = new Readable({ read() {} })
    const started = Promise.withResolvers<void>()
    // A lookup that ends only once the server saw the reader go
    const { server, url } = await serve(stream, response => {
      started.resolve()

      return new Promise(resolve => response.once('close', resolve))
    })
    const controller = new AbortController()
    const request = fetch(url, { signal: controller.signal }).catch(() => null)

    await started.promise
    controller.abort()
    await request

    for (let attempt = 0; attempt < 50 && !stream.destroyed; attempt++) await Bun.sleep(20)

    expect(stream.destroyed).toBe(true)
    server.close()
  })

  test('answers 404 for a file the bucket no longer holds, before any byte', async () => {
    // Failing as the answer first asks for bytes, so only once its listeners are on
    const stream = new Readable({
      read() {
        this.destroy(new Error('No such object'))
      },
    })
    const { server, url } = await serve(stream)
    const response = await fetch(url)

    expect(response.status).toBe(404)
    server.close()
  })
})
