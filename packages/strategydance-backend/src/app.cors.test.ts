import { afterAll, describe, expect, mock, test } from 'bun:test'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

/*
  Which origins the app answers in production, where the app's own are the only ones its routes
  take, and the OAuth protocol's endpoints take any: set before the app is imported, since its
  origins are read once, as a production process reads them
*/
const nodeEnvironment = process.env.NODE_ENV

process.env.NODE_ENV = 'production'

mock.module('~firebase', () => ({ authentication: {}, appCheck: {}, dataConnect: {}, bucket: {} }))

const { default: createApp } = await import('./app')

const server: Server = createApp({ isWorker: false }).listen(0)

await new Promise(resolve => server.once('listening', resolve))

const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

afterAll(() => {
  server.close()
  process.env.NODE_ENV = nodeEnvironment
})

function preflight(path: string, from: string, headers = 'content-type') {
  return fetch(`${origin}${path}`, {
    method: 'OPTIONS',
    headers: {
      Origin: from,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': headers,
    },
  })
}

describe('createApp in production', () => {
  test("answers any origin on the OAuth protocol's endpoints, without credentials", async () => {
    for (const path of [
      '/.well-known/oauth-authorization-server',
      '/oauth/register',
      '/oauth/token',
      '/oauth/token/',
      '/oauth/revoke',
    ]) {
      const response = await preflight(path, 'https://agent.example.com')

      expect(response.headers.get('access-control-allow-origin')).toBe('*')
      expect(response.headers.get('access-control-allow-credentials')).toBeNull()
    }

    const metadata = await fetch(`${origin}/.well-known/oauth-authorization-server`, {
      headers: { Origin: 'https://agent.example.com' },
    })

    expect(metadata.headers.get('access-control-allow-origin')).toBe('*')
    expect(((await metadata.json()) as { issuer: string }).issuer).toBe('https://api.strategydance.com')
  })

  test("keeps the consent page's routes, and every other, to the app's origins", async () => {
    for (const path of ['/oauth/requests/abc', '/oauth/requests/abc/approve', '/users/welcome-email']) {
      const foreign = await preflight(path, 'https://agent.example.com', 'authorization,x-firebase-appcheck')
      const own = await preflight(path, 'https://strategydance.com', 'authorization,x-firebase-appcheck')

      expect(foreign.headers.get('access-control-allow-origin')).toBeNull()
      expect(own.headers.get('access-control-allow-origin')).toBe('https://strategydance.com')
    }
  })
})
