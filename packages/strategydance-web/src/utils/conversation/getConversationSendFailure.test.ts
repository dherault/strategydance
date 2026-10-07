import { describe, expect, mock, test } from 'bun:test'

import {
  ERROR_CODE_BAD_REQUEST,
  ERROR_CODE_CONFLICT,
  ERROR_CODE_CONVERSATION_BUSY,
  ERROR_CODE_CONVERSATION_FULL,
  ERROR_CODE_NOT_FOUND,
  ERROR_CODE_SERVICE_UNAVAILABLE,
  ERROR_CODE_TOO_MANY_CONVERSATIONS,
  ERROR_CODE_UNKNOWN_ERROR,
} from 'strategydance-core'

// The client the API module reads, which a test has no use for and must not start
mock.module('~data/firebase', () => ({ EMULATORS_REQUESTED: true, appCheck: null, authentication: {} }))

const { ApiError } = await import('~data/api')
const { default: getConversationSendFailure } = await import('~utils/conversation/getConversationSendFailure')

describe('getConversationSendFailure', () => {
  test('reads each refusal the reader can do something about', () => {
    expect(getConversationSendFailure(new ApiError(409, ERROR_CODE_CONVERSATION_BUSY, 'Busy'))).toBe('busy')
    expect(getConversationSendFailure(new ApiError(409, ERROR_CODE_CONVERSATION_FULL, 'Full'))).toBe('full')
    expect(getConversationSendFailure(new ApiError(409, ERROR_CODE_TOO_MANY_CONVERSATIONS, 'Too many'))).toBe('tooMany')
    expect(getConversationSendFailure(new ApiError(503, ERROR_CODE_SERVICE_UNAVAILABLE, 'Unavailable'))).toBe(
      'unavailable',
    )
  })

  test('reads a 503 that is not an envelope, as a proxy answers, as the server being unavailable', () => {
    expect(getConversationSendFailure(new ApiError(503, ERROR_CODE_UNKNOWN_ERROR, 'Not JSON'))).toBe('unavailable')
  })

  test('reads every other refusal as a failure', () => {
    expect(getConversationSendFailure(new ApiError(409, ERROR_CODE_CONFLICT, 'Conflict'))).toBe('error')
    expect(getConversationSendFailure(new ApiError(404, ERROR_CODE_NOT_FOUND, 'Not found'))).toBe('error')
    expect(getConversationSendFailure(new ApiError(400, ERROR_CODE_BAD_REQUEST, 'Bad request'))).toBe('error')
    expect(getConversationSendFailure(new ApiError(500, 'SOMETHING_NEW', 'New'))).toBe('error')
  })

  test('reads a connection lost on the way as a failure', () => {
    expect(getConversationSendFailure(new TypeError('Failed to fetch'))).toBe('error')
    expect(getConversationSendFailure(undefined)).toBe('error')
  })
})
