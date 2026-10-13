import { describe, expect, test } from 'bun:test'

import { IntegrationApiKeyScheme, IntegrationAuthentication } from 'strategydance-database/web'

import type { OrganizationIntegration } from '~types'

import getIntegrationFormKey from './getIntegrationFormKey'

const INTEGRATION: OrganizationIntegration = {
  id: 'a1',
  name: 'GitHub',
  url: 'https://api.githubcopilot.com/mcp',
  catalogueSlug: 'github',
  authentication: IntegrationAuthentication.API_KEY,
  isEnabled: true,
  configRevision: 0,
  keyGeneration: 0,
  apiKeyLastFour: '1234',
  apiKeyScheme: IntegrationApiKeyScheme.BEARER,
  apiKeyHeader: null,
  toolCount: 3,
  lastError: null,
  lastErrorAt: null,
  lastUsedAt: null,
  createdAt: '2026-10-13T10:00:00Z',
}

describe('getIntegrationFormKey', () => {
  test('changes with every setting the dialog edits', () => {
    const key = getIntegrationFormKey(INTEGRATION)

    for (const change of [
      { name: 'Code' },
      { url: 'https://mcp.example.com/mcp' },
      { authentication: IntegrationAuthentication.OAUTH },
      { apiKeyScheme: IntegrationApiKeyScheme.HEADER, apiKeyHeader: 'X-API-Key' },
      { apiKeyLastFour: '9999' },
      { keyGeneration: 1 },
      { configRevision: 1 },
    ]) {
      expect(getIntegrationFormKey({ ...INTEGRATION, ...change })).not.toBe(key)
    }
  })

  test('keeps a draft through what the dialog does not edit', () => {
    const key = getIntegrationFormKey(INTEGRATION)

    expect(
      getIntegrationFormKey({ ...INTEGRATION, isEnabled: false, toolCount: 5, lastUsedAt: '2026-10-13T11:00:00Z' }),
    ).toBe(key)
  })
})
