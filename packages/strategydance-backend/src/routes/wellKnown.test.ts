import { afterAll, describe, expect, test } from 'bun:test'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import express from 'express'

const { default: createWellKnownRouter } = await import('./wellKnown')

const app = express()

app.use('/.well-known', createWellKnownRouter())

const server: Server = app.listen(0)

await new Promise(resolve => server.once('listening', resolve))

afterAll(() => {
  server.close()
})

describe('GET /.well-known/oauth-authorization-server', () => {
  test('answers the metadata exactly, every field RFC 8414 requires included', async () => {
    const response = await fetch(
      `http://localhost:${(server.address() as AddressInfo).port}/.well-known/oauth-authorization-server`,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      issuer: 'http://localhost:3003',
      authorization_endpoint: 'http://localhost:3003/oauth/authorize',
      token_endpoint: 'http://localhost:3003/oauth/token',
      registration_endpoint: 'http://localhost:3003/oauth/register',
      revocation_endpoint: 'http://localhost:3003/oauth/revoke',
      // The served modules' alone: Subagents is served to no external agent
      scopes_supported: [
        'knowledge:read',
        'knowledge:write',
        'tasks:read',
        'tasks:write',
        'budget:read',
        'budget:write',
      ],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      revocation_endpoint_auth_methods_supported: ['none'],
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
    })
  })
})
