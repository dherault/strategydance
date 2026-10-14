import { describe, expect, test } from 'bun:test'

import { IntegrationAuthentication, IntegrationConnectionStatus, IntegrationError } from 'strategydance-database/web'

import getIntegrationStatus from './getIntegrationStatus'

const WORKING = {
  isEnabled: true,
  authentication: IntegrationAuthentication.API_KEY,
  toolCount: 3,
  lastError: null,
}

describe('getIntegrationStatus', () => {
  test('says a server that works is connected', () => {
    expect(getIntegrationStatus(WORKING)).toBe('connected')
  })

  test('says a server turned off is off, whatever else holds', () => {
    expect(getIntegrationStatus({ ...WORKING, isEnabled: false, lastError: IntegrationError.TIMED_OUT })).toBe('off')
  })

  test('says a server that failed its last try is in error', () => {
    expect(getIntegrationStatus({ ...WORKING, lastError: IntegrationError.UNREACHABLE })).toBe('error')
  })

  test("says an OAuth server works for the reader once their own account is connected, whoever else's is", () => {
    const oauth = { ...WORKING, authentication: IntegrationAuthentication.OAUTH }

    expect(getIntegrationStatus(oauth)).toBe('needsAuthentication')
    expect(getIntegrationStatus(oauth, { status: IntegrationConnectionStatus.CONNECTED })).toBe('connected')
    expect(getIntegrationStatus(oauth, { status: IntegrationConnectionStatus.NEEDS_AUTHENTICATION })).toBe(
      'needsAuthentication',
    )
  })

  test("never reads a key-based server's status off the reader's connections", () => {
    expect(getIntegrationStatus(WORKING, null)).toBe('connected')
  })
})
