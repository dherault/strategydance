import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

// No route here reaches Firebase: what is checked is which routes each service mounts, which a
// route reached without a token says by refusing it rather than answering 404
mock.module('~firebase', () => ({ authentication: {}, appCheck: {}, dataConnect: {}, bucket: {} }))

const { default: createApp } = await import('./app')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

const CONVERSATION_ID = '1a2b3c4d5e6f40718293a4b5c6d7e8f9'

const servers: Server[] = []
const origins = { backend: '', worker: '' }

async function serve(isWorker: boolean) {
  const server = createApp({ isWorker }).listen(0)

  servers.push(server)

  await new Promise(resolve => server.once('listening', resolve))

  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

function post(origin: string, path: string) {
  return fetch(`${origin}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
}

beforeAll(async () => {
  origins.backend = await serve(false)
  origins.worker = await serve(true)
})

afterAll(() => {
  for (const server of servers) server.close()
})

describe('createApp', () => {
  test('the backend answers its routes and its health check', async () => {
    const health = await fetch(`${origins.backend}/health`)

    expect(health.status).toBe(200)
    expect(await health.json()).toEqual({ status: 'success' })
    expect((await post(origins.backend, '/users/welcome-email')).status).toBe(401)
    expect(
      (await post(origins.backend, `/organizations/${ORGANIZATION_ID}/conversations/${CONVERSATION_ID}/messages`))
        .status,
    ).toBe(401)
  })

  test('the backend answers 404 on the internal routes', async () => {
    expect((await post(origins.backend, '/internal/conversation-runs')).status).toBe(404)
    expect((await post(origins.backend, '/internal/sweep')).status).toBe(404)
  })

  test('the worker answers its internal routes', async () => {
    // An empty body is refused by the route itself, which is there
    expect((await post(origins.worker, '/internal/conversation-runs')).status).toBe(400)
  })

  test('the worker answers 404 on everything else', async () => {
    expect((await fetch(`${origins.worker}/health`)).status).toBe(404)
    expect((await post(origins.worker, '/users/welcome-email')).status).toBe(404)
    expect((await post(origins.worker, '/link-previews')).status).toBe(404)
    expect(
      (await post(origins.worker, `/organizations/${ORGANIZATION_ID}/conversations/${CONVERSATION_ID}/messages`))
        .status,
    ).toBe(404)
  })
})
