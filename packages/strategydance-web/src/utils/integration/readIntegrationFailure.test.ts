import { describe, expect, mock, test } from 'bun:test'

import {
  ERROR_CODE_CONFLICT,
  ERROR_CODE_INTEGRATION_AUTHORIZATION_EXPIRED,
  ERROR_CODE_INTEGRATION_AUTHORIZATION_NOT_YOURS,
  ERROR_CODE_INTEGRATION_CONNECTION_EXPIRED,
  ERROR_CODE_INTEGRATION_CONNECTION_REFUSED,
  ERROR_CODE_INTEGRATION_ISSUER_CHANGED,
  ERROR_CODE_INTEGRATION_KEY_REFUSED,
  ERROR_CODE_INTEGRATION_NAME_TAKEN,
  ERROR_CODE_TOO_MANY_INTEGRATIONS,
  ERROR_CODE_TOO_MANY_REQUESTS,
} from 'strategydance-core'
import { IntegrationError } from 'strategydance-database/web'

mock.module('~data/firebase', () => ({ EMULATORS_REQUESTED: true, appCheck: null, authentication: {} }))

const { ApiError } = await import('~data/api')
const { default: readIntegrationFailure } = await import('~utils/integration/readIntegrationFailure')

describe('readIntegrationFailure', () => {
  test('reads how reaching the server failed as the kind the database keeps', () => {
    expect(readIntegrationFailure(new ApiError(422, ERROR_CODE_INTEGRATION_KEY_REFUSED, 'Refused'))).toBe(
      IntegrationError.KEY_REFUSED,
    )
  })

  test('reads what else a route refused', () => {
    expect(readIntegrationFailure(new ApiError(409, ERROR_CODE_TOO_MANY_INTEGRATIONS, ''))).toBe('full')
    expect(readIntegrationFailure(new ApiError(409, ERROR_CODE_INTEGRATION_NAME_TAKEN, ''))).toBe('nameTaken')
    expect(readIntegrationFailure(new ApiError(409, ERROR_CODE_CONFLICT, ''))).toBe('conflict')
    expect(readIntegrationFailure(new ApiError(429, ERROR_CODE_TOO_MANY_REQUESTS, ''))).toBe('rateLimited')
  })

  test("reads how a member's Connect was refused", () => {
    expect(readIntegrationFailure(new ApiError(409, ERROR_CODE_INTEGRATION_ISSUER_CHANGED, ''))).toBe('issuerChanged')
    expect(readIntegrationFailure(new ApiError(410, ERROR_CODE_INTEGRATION_AUTHORIZATION_EXPIRED, ''))).toBe(
      'authorizationExpired',
    )
    expect(readIntegrationFailure(new ApiError(403, ERROR_CODE_INTEGRATION_AUTHORIZATION_NOT_YOURS, ''))).toBe(
      'authorizationNotYours',
    )
    expect(readIntegrationFailure(new ApiError(422, ERROR_CODE_INTEGRATION_CONNECTION_REFUSED, ''))).toBe(
      'connectionRefused',
    )
    expect(readIntegrationFailure(new ApiError(409, ERROR_CODE_INTEGRATION_CONNECTION_EXPIRED, ''))).toBe(
      'connectionExpired',
    )
  })

  test('reads anything else as unknown', () => {
    expect(readIntegrationFailure(new TypeError('Failed to fetch'))).toBe('unknown')
    expect(readIntegrationFailure(new ApiError(500, 'INTERNAL_ERROR', ''))).toBe('unknown')
  })
})
