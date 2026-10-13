import { describe, expect, mock, test } from 'bun:test'

import {
  ERROR_CODE_CONFLICT,
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

  test('reads anything else as unknown', () => {
    expect(readIntegrationFailure(new TypeError('Failed to fetch'))).toBe('unknown')
    expect(readIntegrationFailure(new ApiError(500, 'INTERNAL_ERROR', ''))).toBe('unknown')
  })
})
