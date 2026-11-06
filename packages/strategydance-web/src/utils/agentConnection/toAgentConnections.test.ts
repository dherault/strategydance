import { describe, expect, test } from 'bun:test'

import toAgentConnections from './toAgentConnections'

const ACME = { id: '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f', slug: 'acme-ab12', name: 'Acme' }
const BETA = { id: '1a2b3c4d5e6f47089a0b1c2d3e4f5a6b', slug: null, name: 'Beta' }

function membership(organization: typeof ACME | typeof BETA, createdAt: string) {
  return {
    organizationId: organization.id,
    createdAt,
    organization: { ...organization, logoUrl: null, logoThumbnailUrl: null, color: null },
  }
}

function connection(organizationIds: string[], grantedAt: string) {
  return {
    id: 'connection',
    clientId: 'https://claude.ai/oauth/mcp-oauth-client-metadata',
    clientName: 'Claude',
    module: 'tasks',
    scopes: ['tasks:read'],
    organizationIds,
    grantedAt,
    createdAt: grantedAt,
    lastUsedAt: null,
  }
}

describe('toAgentConnections', () => {
  test('gives each connection the organizations it reaches, in the order the reader joined them', () => {
    const memberships = [membership(ACME, '2026-01-01T00:00:00Z'), membership(BETA, '2026-02-01T00:00:00Z')]
    const { connections } = toAgentConnections({
      agentConnections: [connection([BETA.id, ACME.id], '2026-11-05T10:00:00.000001Z')],
      memberships,
    })

    expect(connections[0]!.organizations.map(({ name }) => name)).toEqual(['Acme', 'Beta'])
  })

  test('leaves out an organization the reader left, and one they joined again after the grant', () => {
    const { connections } = toAgentConnections({
      agentConnections: [connection([ACME.id, BETA.id], '2026-11-05T10:00:00.000001Z')],
      memberships: [membership(BETA, '2026-11-05T10:00:00.000002Z')],
    })

    expect(connections[0]!.organizations).toEqual([])
  })

  test('hands on the memberships, an edit choosing among them', () => {
    const memberships = [membership(ACME, '2026-01-01T00:00:00Z')]

    expect(toAgentConnections({ agentConnections: [], memberships })).toEqual({ connections: [], memberships })
  })
})
