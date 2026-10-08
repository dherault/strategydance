import { describe, expect, mock, test } from 'bun:test'

import {
  ERROR_CODE_BAD_REQUEST,
  ERROR_CODE_CONFLICT,
  ERROR_CODE_SERVICE_UNAVAILABLE,
  ERROR_CODE_UNKNOWN_ERROR,
} from 'strategydance-core'

// The client the API module reads, which a test has no use for and must not start
mock.module('~data/firebase', () => ({ EMULATORS_REQUESTED: true, appCheck: null, authentication: {} }))

const { ApiError } = await import('~data/api')
const { default: getConversationAnswerFailure } = await import('~utils/conversation/getConversationAnswerFailure')

describe('getConversationAnswerFailure', () => {
  test('reads a question answered elsewhere, and an answer kept the route cannot follow up now', () => {
    expect(getConversationAnswerFailure(new ApiError(409, ERROR_CODE_CONFLICT, 'Answered'))).toBe('conflict')
    expect(getConversationAnswerFailure(new ApiError(503, ERROR_CODE_SERVICE_UNAVAILABLE, 'Unavailable'))).toBe(
      'unavailable',
    )
  })

  test('reads a 503 the route did not send, as a proxy answers one, as an answer to send again', () => {
    expect(getConversationAnswerFailure(new ApiError(503, ERROR_CODE_UNKNOWN_ERROR, 'Bad gateway'))).toBe('error')
  })

  test('reads anything else, a lost connection included, as an answer to send again', () => {
    expect(getConversationAnswerFailure(new ApiError(400, ERROR_CODE_BAD_REQUEST, 'Invalid'))).toBe('error')
    expect(getConversationAnswerFailure(new TypeError('Failed to fetch'))).toBe('error')
  })
})
