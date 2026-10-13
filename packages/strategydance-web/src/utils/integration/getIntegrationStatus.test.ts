import { describe, expect, test } from 'bun:test'

import { IntegrationAuthentication, IntegrationError } from 'strategydance-database/web'

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

  test('says an OAuth server whose tools wait for a connection needs authentication', () => {
    const waiting = { ...WORKING, authentication: IntegrationAuthentication.OAUTH, toolCount: null }

    expect(getIntegrationStatus(waiting)).toBe('needsAuthentication')
    expect(getIntegrationStatus({ ...waiting, toolCount: 4 })).toBe('connected')
  })
})
