import { describe, expect, it } from 'bun:test'

import { MAX_AGENT_CONNECTION_ORGANIZATIONS } from 'strategydance-core'

import type { ModuleAccess } from '~types'

import readModuleAccess from './readModuleAccess'
import toModuleAuthInfo from './toModuleAuthInfo'

const ORGANIZATION = {
  organizationId: '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f',
  membershipCreatedAt: '2026-10-09T10:00:00.000000Z',
}

const EXTERNAL: ModuleAccess = {
  kind: 'external',
  userId: 'member',
  scopes: ['documents:read'],
  connectionScopes: ['documents:read', 'documents:write'],
  idempotencyScope: 'connection:checked',
  organizations: [{ ...ORGANIZATION, segment: 'acme-ab12', name: 'Acme' }],
}

const AGENT: ModuleAccess = {
  kind: 'agent',
  userId: 'member',
  scopes: ['documents:read', 'documents:write'],
  idempotencyScope: 'conversation:checked',
  organization: ORGANIZATION,
}

// What `extra` would carry had something other than `toModuleAuthInfo` written it
function carrying(access: unknown) {
  return { token: 't', clientId: 'c', scopes: [], extra: { access } }
}

describe('readModuleAccess', () => {
  it('reads back the access toModuleAuthInfo carried, an external agent’s and Strategy Dance’s agent’s', () => {
    expect(readModuleAccess(toModuleAuthInfo(EXTERNAL))).toEqual(EXTERNAL)
    expect(readModuleAccess(toModuleAuthInfo(AGENT))).toEqual(AGENT)
  })

  it('carries the scopes and whatever an access token says beside the access', () => {
    const resource = new URL('https://api.strategydance.com/mcp/documents')
    const authInfo = toModuleAuthInfo(EXTERNAL, { token: 'token', clientId: 'client', expiresAt: 1, resource })

    expect(authInfo).toMatchObject({
      token: 'token',
      clientId: 'client',
      expiresAt: 1,
      resource,
      scopes: ['documents:read'],
    })
  })

  it("reads back an external agent's connection scopes beside its token's, and refuses an access missing them", () => {
    expect(readModuleAccess(toModuleAuthInfo(EXTERNAL))).toMatchObject({
      scopes: ['documents:read'],
      connectionScopes: ['documents:read', 'documents:write'],
    })

    const { connectionScopes: _left, ...withoutThem } = EXTERNAL as Extract<ModuleAccess, { kind: 'external' }>

    expect(() => readModuleAccess(carrying(withoutThem))).toThrow()
    expect(() => readModuleAccess(carrying({ ...EXTERNAL, connectionScopes: ['admin'] }))).toThrow()
    expect(() => readModuleAccess(carrying({ ...AGENT, connectionScopes: ['documents:read'] }))).toThrow()
  })

  it('reads back the run calling, which a worker that claimed one fills, for Strategy Dance’s agent', () => {
    const access: ModuleAccess = {
      ...AGENT,
      launcher: { conversationId: '1a2b3c4d5e6f40718293a4b5c6d7e8f9', runId: '9f8e7d6c5b4a40392817f6e5d4c3b2a1' },
    }

    expect(readModuleAccess(toModuleAuthInfo(access))).toEqual(access)
  })

  it('refuses a request that carries no access, or one it did not write', () => {
    expect(() => readModuleAccess(undefined)).toThrow()
    expect(() => readModuleAccess({ token: 't', clientId: 'c', scopes: [] })).toThrow()
    expect(() => readModuleAccess(carrying({ ...EXTERNAL, scopes: ['admin'] }))).toThrow()
    expect(() => readModuleAccess(carrying({ ...EXTERNAL, kind: 'administrator' }))).toThrow()
  })

  it('refuses a field it does not know, and a launcher it did not write, rather than drop them', () => {
    for (const access of [
      { ...EXTERNAL, isAdministrator: true },
      { ...EXTERNAL, launcher: { conversationId: 'conversation', runId: 'run' } },
      { ...EXTERNAL, organization: ORGANIZATION },
      { ...EXTERNAL, organizations: [{ ...ORGANIZATION, segment: 'acme-ab12', name: 'Acme', role: 'ADMINISTRATOR' }] },
      { ...AGENT, organizations: EXTERNAL.organizations },
      { ...AGENT, launcher: { conversationId: 'conversation' } },
      { ...AGENT, launcher: { conversationId: 'conversation', runId: 'run', attempts: 1 } },
      { ...AGENT, launcher: { conversationId: '', runId: 'run' } },
    ]) {
      expect(() => readModuleAccess(carrying(access))).toThrow()
    }
  })

  it('reads back an external access reaching as many organizations as a connection may', () => {
    const organizations = Array.from({ length: MAX_AGENT_CONNECTION_ORGANIZATIONS }, (_, index) => ({
      ...ORGANIZATION,
      segment: `organization-${index}`,
      name: `Organization ${index}`,
    }))

    expect(readModuleAccess(toModuleAuthInfo({ ...EXTERNAL, organizations }))).toEqual({ ...EXTERNAL, organizations })
    expect(() =>
      readModuleAccess(carrying({ ...EXTERNAL, organizations: [...organizations, organizations[0]] })),
    ).toThrow()
  })

  it('refuses an external access reaching no organization, or one named by nothing', () => {
    expect(() => readModuleAccess(carrying({ ...EXTERNAL, organizations: [] }))).toThrow()
    expect(() =>
      readModuleAccess(carrying({ ...EXTERNAL, organizations: [{ ...ORGANIZATION, segment: '', name: 'Acme' }] })),
    ).toThrow()
  })
})
