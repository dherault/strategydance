import { afterEach, beforeEach, describe, expect, mock, setSystemTime, test } from 'bun:test'

import { SERVED_MODULE_NAMES } from 'strategydance-core'

import createModuleDatabaseFakeBase from '~domain/modules/testing/createModuleDatabaseFakeBase'
import createOAuthDatabaseFake from '~domain/oauth/testing/createOAuthDatabaseFake'

const fake = createOAuthDatabaseFake(createModuleDatabaseFakeBase())

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: pruneAgentConnectionTokens } = await import('./pruneAgentConnectionTokens')
const { default: pruneOAuthAuthorizationRequests } = await import('./pruneOAuthAuthorizationRequests')
const { default: pruneOAuthClients } = await import('./pruneOAuthClients')
const { default: pruneUnservedAgentConnections } = await import('./pruneUnservedAgentConnections')

const HOUR_MS = 60 * 60 * 1000
const ORGANIZATION_ID = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'

function ago(milliseconds: number) {
  return new Date(Date.now() - milliseconds).toISOString()
}

function insertClient(id: string, { createdAt = ago(0), lastUsedAt = null as string | null } = {}) {
  fake.clients.set(id, { id, name: null, redirectUris: ['http://127.0.0.1/callback'], createdAt, lastUsedAt })
}

function insertRequest(id: string, expiresAt: string) {
  fake.requests.set(id, {
    id,
    clientId: 'https://client.example.com/oauth/metadata.json',
    registeredClientId: null,
    redirectUri: 'https://client.example.com/callback',
    codeChallenge: 'challenge',
    resource: 'http://localhost:3003/mcp/documents',
    scopes: ['documents:read'],
    state: null,
    expiresAt,
    decidedAt: null,
    isApproved: null,
    connectionId: null,
    codeHash: null,
    codeExpiresAt: null,
    codeUsedAt: null,
    createdAt: expiresAt,
  })
}

function insertConnection(id: string, registeredClientId: string | null, module = 'documents') {
  fake.addMember('member', ORGANIZATION_ID)
  fake.connections.set(id, {
    id,
    userId: 'member',
    organizationId: ORGANIZATION_ID,
    clientId: registeredClientId ?? 'https://client.example.com/oauth/metadata.json',
    registeredClientId,
    clientName: null,
    module,
    scopes: [`${module}:read`],
    createdAt: ago(0),
    lastUsedAt: null,
  })
}

function insertToken(id: string, expiresAt: string, usedAt: string | null = null) {
  fake.tokens.set(id, {
    id,
    connectionId: 'connection',
    kind: 'REFRESH',
    hash: id,
    resource: 'http://localhost:3003/mcp/documents',
    scopes: ['documents:read'],
    issuedFrom: 'request',
    expiresAt,
    usedAt,
    successorKeyVersion: usedAt ? 1 : null,
    createdAt: ago(0),
  })
}

beforeEach(() => {
  fake.reset()
})

afterEach(() => {
  setSystemTime()
})

describe('pruneOAuthAuthorizationRequests', () => {
  test('deletes the requests expired over a day ago, and keeps a day’s for a code presented again', async () => {
    insertRequest('old', ago(25 * HOUR_MS))
    insertRequest('expired', ago(HOUR_MS))
    insertRequest('pending', new Date(Date.now() + HOUR_MS).toISOString())

    expect(await pruneOAuthAuthorizationRequests()).toEqual({ deleted: 1 })
    expect([...fake.requests.keys()].sort()).toEqual(['expired', 'pending'])
    expect(await pruneOAuthAuthorizationRequests()).toEqual({ deleted: 0 })
  })
})

describe('pruneUnservedAgentConnections', () => {
  test('deletes the connections to a module no endpoint serves, with their tokens, and keeps the rest', async () => {
    insertConnection('connection', null, 'retired')
    insertToken('retired-token', new Date(Date.now() + HOUR_MS).toISOString())

    for (const module of SERVED_MODULE_NAMES) insertConnection(module, null, module)

    expect(await pruneUnservedAgentConnections()).toEqual({ deleted: 1 })
    expect([...fake.connections.keys()].sort()).toEqual([...SERVED_MODULE_NAMES].sort())
    expect(fake.tokens.size).toBe(0)
    expect(await pruneUnservedAgentConnections()).toEqual({ deleted: 0 })
  })
})

describe('pruneAgentConnectionTokens', () => {
  test('deletes the tokens past their expiry, a spent refresh token included, and keeps the rest', async () => {
    insertConnection('connection', null)
    insertToken('expired', ago(1000))
    insertToken('spent-expired', ago(1000), ago(31 * 24 * HOUR_MS))
    insertToken('spent', new Date(Date.now() + HOUR_MS).toISOString(), ago(HOUR_MS))
    insertToken('live', new Date(Date.now() + HOUR_MS).toISOString())

    expect(await pruneAgentConnectionTokens()).toEqual({ deleted: 2 })
    expect([...fake.tokens.keys()].sort()).toEqual(['live', 'spent'])
  })
})

describe('pruneOAuthClients', () => {
  test('deletes a registration over a day old that nothing used for a day and no connection uses', async () => {
    insertClient('unused', { createdAt: ago(25 * HOUR_MS) })
    insertClient('stale', { createdAt: ago(50 * HOUR_MS), lastUsedAt: ago(25 * HOUR_MS) })
    insertClient('recent', { createdAt: ago(HOUR_MS) })
    insertClient('used', { createdAt: ago(50 * HOUR_MS), lastUsedAt: ago(HOUR_MS) })
    insertClient('connected', { createdAt: ago(50 * HOUR_MS) })
    insertConnection('connection', 'connected')

    expect(await pruneOAuthClients()).toEqual({ deleted: 2 })
    expect([...fake.clients.keys()].sort()).toEqual(['connected', 'recent', 'used'])
  })
})
