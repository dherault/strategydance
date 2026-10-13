import { afterAll, beforeEach, describe, expect, mock, setSystemTime, test } from 'bun:test'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import express, { type NextFunction, type Request, type Response } from 'express'
import {
  ERROR_CODE_BAD_REQUEST,
  ERROR_CODE_CONFLICT,
  ERROR_CODE_FORBIDDEN,
  ERROR_CODE_INTEGRATION_KEY_REFUSED,
  ERROR_CODE_INTEGRATION_NAME_TAKEN,
  ERROR_CODE_NOT_FOUND,
  ERROR_CODE_SERVICE_UNAVAILABLE,
  ERROR_CODE_TOO_MANY_INTEGRATIONS,
  ERROR_CODE_UNAUTHORIZED_AUTHENTICATION,
  MAX_INTEGRATIONS,
} from 'strategydance-core'
import type { IntegrationError as StoredIntegrationError } from 'strategydance-database/backend'

import type { IntegrationConfiguration, IntegrationReach } from '~domain/integrations/reachIntegration'
import createIntegrationDatabaseFake, {
  IntegrationError,
  OrganizationRole,
} from '~domain/integrations/testing/createIntegrationDatabaseFake'

const fake = createIntegrationDatabaseFake()

// What reaching a server finds, each test saying what, and every configuration it was asked to reach
let reached: Record<string, any>[] = []
let answer: (configuration: IntegrationConfiguration) => Promise<IntegrationReach> = async () => listed(['hash-a'])

function listed(hashes: string[]): IntegrationReach {
  return {
    tools: JSON.stringify(hashes.map(hash => ({ name: hash, inputSchema: { type: 'object' }, definitionHash: hash }))),
    toolCount: hashes.length,
    toolDefinitionHashes: hashes,
    issuer: null,
  }
}

function discovered(issuer: string): IntegrationReach {
  return { tools: null, toolCount: null, toolDefinitionHashes: [], issuer }
}

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)
mock.module('~domain/integrations/reachIntegration', () => ({
  default: async (configuration: IntegrationConfiguration) => {
    reached.push(configuration)

    return answer(configuration)
  },
}))

// Metering is the instance's, which these tests would exhaust between them
mock.module('~middleware/integrationRateLimit', () => ({
  default: (_request: Request, _response: Response, next: NextFunction) => next(),
}))

mock.module('~middleware/appCheck', () => ({
  default: (_request: Request, _response: Response, next: NextFunction) => next(),
}))

// The caller the request names, or nobody, refused as the real middleware refuses a request with no token
mock.module('~middleware/authentication', () => ({
  default: (request: Request, response: Response, next: NextFunction) => {
    const viewer = request.header('x-viewer')

    if (!viewer) {
      response.status(401).json({ status: 'error', code: ERROR_CODE_UNAUTHORIZED_AUTHENTICATION, message: 'No token' })

      return
    }

    request.viewer = { id: viewer, email: null }
    next()
  },
}))

const { default: IntegrationFailure } = await import('~domain/integrations/IntegrationFailure')
const { default: decryptIntegrationKey } = await import('~domain/integrations/decryptIntegrationKey')
const { default: createIntegrationsRouter } = await import('./integrations')

const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const ADMINISTRATOR = 'administrator'
const MEMBER = 'member'

const app = express()

app.use('/organizations/:organizationId/integrations', createIntegrationsRouter())

const server: Server = app.listen(0)

await new Promise(resolve => server.once('listening', resolve))

const origin = `http://localhost:${(server.address() as AddressInfo).port}`

afterAll(() => {
  server.close()
  setSystemTime()
})

beforeEach(() => {
  fake.reset()
  fake.addMember(ADMINISTRATOR, ORGANIZATION_ID, OrganizationRole.ADMINISTRATOR)
  fake.addMember(MEMBER, ORGANIZATION_ID)
  fake.staff.add(ADMINISTRATOR)
  fake.staff.add(MEMBER)
  reached = []
  answer = async () => listed(['hash-a'])
  setSystemTime()
})

async function call(method: string, path: string, body?: unknown, viewer: string | null = ADMINISTRATOR) {
  const response = await fetch(`${origin}/organizations/${ORGANIZATION_ID}/integrations${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(viewer && { 'x-viewer': viewer }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  return { status: response.status, body: (await response.json()) as { code?: string; data?: any } }
}

const KEYED = {
  name: 'GitHub',
  url: 'https://api.githubcopilot.com/mcp',
  authentication: 'API_KEY',
  apiKey: 'ghp_secret1234',
}

const OPEN = { name: 'DeepWiki', url: 'https://mcp.deepwiki.com/mcp', authentication: 'NONE' }

async function add(body: Record<string, unknown> = KEYED) {
  const { status, body: answered } = await call('POST', '', body)

  expect(status).toBe(200)

  return fake.integrations.get(answered.data.integrationId.replaceAll('-', ''))!
}

describe('adding a server', () => {
  test('stores a key-based server with what it listed, its key encrypted for this row alone', async () => {
    const { status, body } = await call('POST', '', KEYED)

    expect(status).toBe(200)
    expect(body.data.toolCount).toBe(1)

    const stored = fake.integrations.get(body.data.integrationId.replaceAll('-', ''))!

    expect(stored).toMatchObject({
      name: 'GitHub',
      normalizedName: 'github',
      url: 'https://api.githubcopilot.com/mcp',
      catalogueSlug: 'github',
      apiKeyLastFour: '1234',
      apiKeyScheme: 'BEARER',
      apiKeyHeader: null,
      toolCount: 1,
      toolDefinitionHashes: ['hash-a'],
    })
    expect(stored.encryptedApiKey).toStartWith('v1:local:')
    expect(
      await decryptIntegrationKey(stored.encryptedApiKey!, {
        organizationId: ORGANIZATION_ID,
        integrationId: stored.id,
      }),
    ).toBe('ghp_secret1234')
    expect(reached[0].credential).toEqual({ key: 'ghp_secret1234', scheme: 'BEARER', header: null })
  })

  test("stores an OAuth server's issuer, its tools waiting for a connection", async () => {
    answer = async () => discovered('https://mcp.linear.app')

    const stored = await add({ name: 'Linear', url: 'https://mcp.linear.app/mcp', authentication: 'OAUTH' })

    expect(stored).toMatchObject({
      issuer: 'https://mcp.linear.app',
      tools: null,
      toolCount: null,
      encryptedApiKey: null,
    })
    expect(reached[0].credential).toBeNull()
  })

  test('marks a server with the external MCP server at its address, whatever the caller says', async () => {
    expect((await add({ ...OPEN, name: 'Elsewhere', catalogueSlug: 'github' })).catalogueSlug).toBeNull()

    answer = async () => discovered('https://mcp.linear.app')

    expect(
      (await add({ name: 'Issues', url: 'https://mcp.linear.app/mcp', authentication: 'OAUTH' })).catalogueSlug,
    ).toBe('linear')
  })

  test('shows no part of a key too short to show', async () => {
    const stored = await add({ ...KEYED, apiKey: 'abcd' })

    expect(stored.apiKeyLastFour).toBeNull()

    await call('PATCH', `/${stored.id}`, { ...KEYED, apiKey: 'short_key' })

    expect(stored.apiKeyLastFour).toBeNull()

    await call('PATCH', `/${stored.id}`, { ...KEYED, apiKey: 'a_long_enough_key_5678' })

    expect(stored.apiKeyLastFour).toBe('5678')
  })

  test('sends a key in the header named', async () => {
    const stored = await add({ ...KEYED, apiKeyScheme: 'HEADER', apiKeyHeader: 'X-API-Key' })

    expect(reached[0].credential).toEqual({ key: 'ghp_secret1234', scheme: 'HEADER', header: 'X-API-Key' })
    expect(stored).toMatchObject({ apiKeyScheme: 'HEADER', apiKeyHeader: 'X-API-Key' })
  })

  test('refuses a form that is not one, reaching nothing', async () => {
    for (const body of [
      { ...OPEN, url: 'http://mcp.deepwiki.com/mcp' },
      { ...OPEN, url: 'https://mcp.deepwiki.com:8443/mcp' },
      { ...OPEN, name: '  ' },
      { ...OPEN, name: 'Two\nlines' },
      { ...OPEN, apiKey: 'a key for a server taking none' },
      { ...KEYED, apiKey: undefined },
      { ...KEYED, apiKey: 'key\r\nX-Injected: 1' },
      { ...KEYED, apiKeyScheme: 'HEADER' },
      { ...KEYED, apiKeyScheme: 'HEADER', apiKeyHeader: 'Content-Type' },
      { ...KEYED, apiKeyScheme: 'HEADER', apiKeyHeader: 'Mcp-Session-Id' },
      { ...OPEN, authentication: 'PASSWORD' },
    ]) {
      const { status, body: answered } = await call('POST', '', body)

      expect(status).toBe(400)
      expect(answered.code).toBe(ERROR_CODE_BAD_REQUEST)
    }

    expect(reached).toHaveLength(0)
  })

  test('saves nothing when the server cannot be reached, and says why', async () => {
    answer = async () => {
      throw new IntegrationFailure(
        IntegrationError.KEY_REFUSED as StoredIntegrationError,
        'https://api.githubcopilot.com: KEY_REFUSED',
      )
    }

    const { status, body } = await call('POST', '', KEYED)

    expect(status).toBe(422)
    expect(body.code).toBe(ERROR_CODE_INTEGRATION_KEY_REFUSED)
    expect(fake.integrations.size).toBe(0)
  })

  test('refuses a name another server has, whatever its case', async () => {
    await add(OPEN)

    const { status, body } = await call('POST', '', { ...OPEN, name: ' deepwiki ' })

    expect(status).toBe(409)
    expect(body.code).toBe(ERROR_CODE_INTEGRATION_NAME_TAKEN)
  })

  test('refuses a server past the organization limit', async () => {
    for (let index = 0; index < MAX_INTEGRATIONS; index++) await add({ ...OPEN, name: `Server ${index}` })

    const { status, body } = await call('POST', '', { ...OPEN, name: 'One more' })

    expect(status).toBe(409)
    expect(body.code).toBe(ERROR_CODE_TOO_MANY_INTEGRATIONS)
  })

  test("is an administrator's alone, and staff's alone while conversations are", async () => {
    expect((await call('POST', '', OPEN, null)).status).toBe(401)
    expect((await call('POST', '', OPEN, MEMBER)).body.code).toBe(ERROR_CODE_FORBIDDEN)

    fake.staff.delete(ADMINISTRATOR)

    expect((await call('POST', '', OPEN)).body.code).toBe(ERROR_CODE_FORBIDDEN)
    expect(reached).toHaveLength(0)
  })
})

describe('changing a server', () => {
  test('renames it alone without reaching it', async () => {
    const stored = await add()

    reached = []

    const { status } = await call('PATCH', `/${stored.id}`, { ...KEYED, name: 'Code', apiKey: null })

    expect(status).toBe(200)
    expect(stored.name).toBe('Code')
    expect(reached).toHaveLength(0)
  })

  test("takes a key-based server's key again for another address, and clears everything given for the old one", async () => {
    const stored = await add()

    stored.autoApprovedTools = ['hash-a']

    const moved = { ...KEYED, url: 'https://mcp.elsewhere.example/mcp', apiKey: null }

    expect((await call('PATCH', `/${stored.id}`, moved)).status).toBe(400)

    answer = async () => listed(['hash-a'])

    const { status } = await call('PATCH', `/${stored.id}`, { ...moved, apiKey: 'new_key_5678' })

    expect(status).toBe(200)
    expect(reached.at(-1)).toMatchObject({
      url: 'https://mcp.elsewhere.example/mcp',
      credential: { key: 'new_key_5678' },
    })
    expect(stored).toMatchObject({ autoApprovedTools: [], configRevision: 1, keyGeneration: 1, apiKeyLastFour: '5678' })
  })

  test('takes the slug of the external MCP server at the new address, or none', async () => {
    const stored = await add()

    answer = async () => discovered('https://mcp.linear.app')
    await call('PATCH', `/${stored.id}`, {
      ...KEYED,
      url: 'https://mcp.linear.app/mcp',
      authentication: 'OAUTH',
      apiKey: null,
    })

    expect(stored.catalogueSlug).toBe('linear')

    await call('PATCH', `/${stored.id}`, {
      ...KEYED,
      url: 'https://mcp.elsewhere.example/mcp',
      authentication: 'OAUTH',
      apiKey: null,
    })

    expect(stored.catalogueSlug).toBeNull()
  })

  test('answers a key it cannot read as a service that cannot take it now', async () => {
    const stored = await add()

    stored.encryptedApiKey = 'v1:local:unreadable'

    const edited = await call('PATCH', `/${stored.id}`, {
      ...KEYED,
      apiKey: null,
      apiKeyScheme: 'HEADER',
      apiKeyHeader: 'X-API-Key',
    })

    expect(edited.status).toBe(503)
    expect(edited.body.code).toBe(ERROR_CODE_SERVICE_UNAVAILABLE)
    expect((await call('POST', `/${stored.id}/retry`)).body.code).toBe(ERROR_CODE_SERVICE_UNAVAILABLE)
  })

  test('clears the key when a server stops taking one', async () => {
    const stored = await add()

    answer = async () => discovered('https://auth.example.com')

    await call('PATCH', `/${stored.id}`, { ...KEYED, authentication: 'OAUTH', apiKey: null })

    expect(stored).toMatchObject({ encryptedApiKey: null, apiKeyLastFour: null, issuer: 'https://auth.example.com' })
  })

  test('replaces a key at the same address, keeping the approvals of the tools still listed', async () => {
    answer = async () => listed(['hash-a', 'hash-b'])

    const stored = await add()

    stored.autoApprovedTools = ['hash-a', 'hash-b']
    answer = async () => listed(['hash-a'])

    const { status } = await call('PATCH', `/${stored.id}`, { ...KEYED, apiKey: 'replaced_9999' })

    expect(status).toBe(200)
    expect(reached.at(-1)?.credential?.key).toBe('replaced_9999')
    expect(stored).toMatchObject({
      autoApprovedTools: ['hash-a'],
      keyGeneration: 1,
      configRevision: 0,
      apiKeyLastFour: '9999',
    })
  })

  test('sends the stored key in another header, bumping the revision', async () => {
    const stored = await add()

    await call('PATCH', `/${stored.id}`, { ...KEYED, apiKey: null, apiKeyScheme: 'HEADER', apiKeyHeader: 'X-API-Key' })

    expect(reached.at(-1)?.credential).toEqual({ key: 'ghp_secret1234', scheme: 'HEADER', header: 'X-API-Key' })
    expect(stored).toMatchObject({ apiKeyScheme: 'HEADER', configRevision: 1, keyGeneration: 0 })
  })

  test('refuses a change made over a rename made meanwhile, keeping the rename', async () => {
    const moved = await add({ ...OPEN, name: 'Open' })

    answer = async () => {
      moved.name = 'Renamed first'

      return listed(['hash-a'])
    }

    expect(
      (await call('PATCH', `/${moved.id}`, { ...OPEN, name: 'Open', url: 'https://mcp.moved.example/mcp' })).status,
    ).toBe(409)
    expect(moved.name).toBe('Renamed first')

    const stored = await add()

    answer = async () => {
      stored.name = 'Renamed meanwhile'
      stored.normalizedName = 'renamed meanwhile'

      return listed(['hash-a'])
    }

    const { status, body } = await call('PATCH', `/${stored.id}`, { ...KEYED, apiKey: 'replaced_9999' })

    expect(status).toBe(409)
    expect(body.code).toBe(ERROR_CODE_CONFLICT)
    expect(stored.name).toBe('Renamed meanwhile')
  })

  test('refuses a change made over another made meanwhile', async () => {
    const stored = await add()

    answer = async () => {
      stored.configRevision++

      return listed(['hash-a'])
    }

    const { status, body } = await call('PATCH', `/${stored.id}`, { ...KEYED, apiKey: 'replaced_9999' })

    expect(status).toBe(409)
    expect(body.code).toBe(ERROR_CODE_CONFLICT)
  })
})

describe('retrying a server', () => {
  test('stores the tools it lists, dropping the approvals of those it no longer does', async () => {
    answer = async () => listed(['hash-a', 'hash-b'])

    const stored = await add()

    stored.autoApprovedTools = ['hash-a', 'hash-b']
    stored.lastError = IntegrationError.TIMED_OUT
    answer = async () => listed(['hash-b', 'hash-c'])

    expect((await call('POST', `/${stored.id}/retry`)).status).toBe(200)
    expect(reached.at(-1)?.credential?.key).toBe('ghp_secret1234')
    expect(stored).toMatchObject({ autoApprovedTools: ['hash-b'], toolCount: 2, lastError: null })
  })

  test('records why it failed', async () => {
    const stored = await add()

    answer = async () => {
      throw new IntegrationFailure(
        IntegrationError.TIMED_OUT as StoredIntegrationError,
        'https://api.githubcopilot.com: TIMED_OUT',
      )
    }

    expect((await call('POST', `/${stored.id}/retry`)).status).toBe(422)
    expect(stored.lastError).toBe(IntegrationError.TIMED_OUT)
  })

  test("keeps an OAuth server's issuer found again, and clears everything given for another", async () => {
    answer = async () => discovered('https://auth.example.com')

    const stored = await add({ name: 'Linear', url: 'https://mcp.linear.app/mcp', authentication: 'OAUTH' })

    stored.lastError = IntegrationError.UNREACHABLE
    stored.autoApprovedTools = ['hash-a']

    await call('POST', `/${stored.id}/retry`)

    expect(stored).toMatchObject({ lastError: null, configRevision: 0, autoApprovedTools: ['hash-a'] })

    answer = async () => discovered('https://other.example.com')

    await call('POST', `/${stored.id}/retry`)

    expect(stored).toMatchObject({ issuer: 'https://other.example.com', configRevision: 1, autoApprovedTools: [] })
  })
})

describe('turning a server on and off, and its tools', () => {
  test('turns a server off and on', async () => {
    const stored = await add()

    await call('PUT', `/${stored.id}/enabled`, { isEnabled: false })

    expect(stored.isEnabled).toBe(false)
    expect((await call('PUT', `/${stored.id}/enabled`, { isEnabled: true }, MEMBER)).body.code).toBe(
      ERROR_CODE_FORBIDDEN,
    )
  })

  test('lets a listed tool run without approval by its hash, and takes that back', async () => {
    const hash = 'a'.repeat(64)

    answer = async () => listed([hash])

    const stored = await add()

    expect(
      (await call('PUT', `/${stored.id}/auto-approved-tools`, { definitionHash: hash, isAutoApproved: true })).status,
    ).toBe(200)
    expect(stored.autoApprovedTools).toEqual([hash])

    const unlisted = await call('PUT', `/${stored.id}/auto-approved-tools`, {
      definitionHash: 'b'.repeat(64),
      isAutoApproved: true,
    })

    expect(unlisted.body.code).toBe(ERROR_CODE_CONFLICT)

    await call('PUT', `/${stored.id}/auto-approved-tools`, { definitionHash: hash, isAutoApproved: false })

    expect(stored.autoApprovedTools).toEqual([])
  })
})

describe('deleting a server', () => {
  test('keeps it, its key included, for an Undo within a day', async () => {
    const stored = await add()

    expect((await call('DELETE', `/${stored.id}`)).status).toBe(200)
    expect(stored.deletedAt).not.toBeNull()
    expect(stored.encryptedApiKey).not.toBeNull()
    expect((await call('POST', `/${stored.id}/restore`)).status).toBe(200)
    expect(stored.deletedAt).toBeNull()
  })

  test('refuses an Undo once another server took its name, or a day has passed', async () => {
    const stored = await add()

    await call('DELETE', `/${stored.id}`)

    const other = await add({ ...KEYED, name: 'github' })

    expect((await call('POST', `/${stored.id}/restore`)).body.code).toBe(ERROR_CODE_INTEGRATION_NAME_TAKEN)

    await call('DELETE', `/${other.id}`)
    setSystemTime(new Date(Date.now() + 25 * 60 * 60 * 1000))

    expect((await call('POST', `/${stored.id}/restore`)).body.code).toBe(ERROR_CODE_NOT_FOUND)
  })
})
