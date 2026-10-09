import { describe, expect, mock, test } from 'bun:test'

import { ERROR_CODE_BAD_REQUEST, ERROR_CODE_TOO_MANY_REQUESTS, ERROR_CODE_UNKNOWN_ERROR } from 'strategydance-core'

// The client the API module reads, which a test has no use for and must not start
mock.module('~data/firebase', () => ({ EMULATORS_REQUESTED: true, appCheck: null, authentication: {} }))

const { ApiError } = await import('~data/api')
const { default: getConversationSearchFailure } = await import('~utils/conversation/getConversationSearchFailure')

describe('getConversationSearchFailure', () => {
  test('reads the allowance used up, from the backend or from a proxy in front of it', () => {
    expect(getConversationSearchFailure(new ApiError(429, ERROR_CODE_TOO_MANY_REQUESTS, 'Too many'))).toBe('tooMany')
    expect(getConversationSearchFailure(new ApiError(429, ERROR_CODE_UNKNOWN_ERROR, 'Not JSON'))).toBe('tooMany')
  })

  test('reads anything else as a failure the same search may get past', () => {
    expect(getConversationSearchFailure(new ApiError(400, ERROR_CODE_BAD_REQUEST, 'Bad request'))).toBe('error')
    expect(getConversationSearchFailure(new TypeError('Failed to fetch'))).toBe('error')
  })
})
