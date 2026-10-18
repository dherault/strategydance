import { describe, expect, mock, test } from 'bun:test'

import {
  ERROR_CODE_ACCOUNT_DAILY_CONVERSATIONS_REACHED,
  ERROR_CODE_ACCOUNT_DAILY_RUNS_REACHED,
  ERROR_CODE_BAD_REQUEST,
  ERROR_CODE_CONFLICT,
  ERROR_CODE_CONVERSATION_ATTACHMENTS_OVER_BUDGET,
  ERROR_CODE_CONVERSATION_BUSY,
  ERROR_CODE_CONVERSATION_FULL,
  ERROR_CODE_MEMBER_DAILY_CONVERSATIONS_REACHED,
  ERROR_CODE_MEMBER_DAILY_RUNS_REACHED,
  ERROR_CODE_NOT_FOUND,
  ERROR_CODE_ORGANIZATION_DAILY_CONVERSATIONS_REACHED,
  ERROR_CODE_ORGANIZATION_DAILY_RUNS_REACHED,
  ERROR_CODE_SERVICE_UNAVAILABLE,
  ERROR_CODE_TOO_MANY_CONVERSATIONS,
  ERROR_CODE_UNKNOWN_ERROR,
} from 'strategydance-core'

// The client the API module reads, which a test has no use for and must not start
mock.module('~data/firebase', () => ({ EMULATORS_REQUESTED: true, appCheck: null, authentication: {} }))

const { ApiError } = await import('~data/api')
const { default: getConversationSendFailure } = await import('~utils/conversation/getConversationSendFailure')
const { default: getConversationFailureRetryAt } = await import('~utils/conversation/getConversationFailureRetryAt')
const { default: isConversationCapFailure } = await import('~utils/conversation/isConversationCapFailure')

describe('getConversationSendFailure', () => {
  test('reads each refusal the reader can do something about', () => {
    expect(getConversationSendFailure(new ApiError(409, ERROR_CODE_CONVERSATION_BUSY, 'Busy'))).toBe('busy')
    expect(getConversationSendFailure(new ApiError(409, ERROR_CODE_CONVERSATION_FULL, 'Full'))).toBe('full')
    expect(getConversationSendFailure(new ApiError(409, ERROR_CODE_TOO_MANY_CONVERSATIONS, 'Too many'))).toBe('tooMany')
    expect(getConversationSendFailure(new ApiError(503, ERROR_CODE_SERVICE_UNAVAILABLE, 'Unavailable'))).toBe(
      'unavailable',
    )
  })

  test('reads which daily cap a start reached, and when it has room again', () => {
    const now = Date.parse('2026-10-18T12:00:00Z')
    const caps = [
      [ERROR_CODE_MEMBER_DAILY_CONVERSATIONS_REACHED, 'memberConversationsCapped'],
      [ERROR_CODE_ACCOUNT_DAILY_CONVERSATIONS_REACHED, 'accountConversationsCapped'],
      [ERROR_CODE_ORGANIZATION_DAILY_CONVERSATIONS_REACHED, 'organizationConversationsCapped'],
      [ERROR_CODE_MEMBER_DAILY_RUNS_REACHED, 'memberRunsCapped'],
      [ERROR_CODE_ACCOUNT_DAILY_RUNS_REACHED, 'accountRunsCapped'],
      [ERROR_CODE_ORGANIZATION_DAILY_RUNS_REACHED, 'organizationRunsCapped'],
    ] as const

    for (const [code, failure] of caps) {
      const error = new ApiError(429, code, 'Capped', 3_600_000)

      expect(getConversationSendFailure(error, true)).toBe(failure)
      expect(isConversationCapFailure(getConversationSendFailure(error))).toBe(true)
      expect(getConversationFailureRetryAt(error, now)).toBe(now + 3_600_000)
    }

    expect(isConversationCapFailure('busy')).toBe(false)
    expect(isConversationCapFailure(null)).toBe(false)
    expect(getConversationFailureRetryAt(new ApiError(409, ERROR_CODE_CONVERSATION_BUSY, 'Busy'), now)).toBeNull()
    expect(getConversationFailureRetryAt(new TypeError('Failed to fetch'), now)).toBeNull()
  })

  test('reads files the conversation has no room for, whether the message sends files or not', () => {
    const overBudget = new ApiError(409, ERROR_CODE_CONVERSATION_ATTACHMENTS_OVER_BUDGET, 'Over budget')

    expect(getConversationSendFailure(overBudget, true)).toBe('overBudget')
    expect(getConversationSendFailure(overBudget)).toBe('overBudget')
  })

  test('reads a message sending files refused as malformed or in conflict as files to upload again', () => {
    expect(getConversationSendFailure(new ApiError(400, ERROR_CODE_BAD_REQUEST, 'Not ready'), true)).toBe('filesGone')
    expect(getConversationSendFailure(new ApiError(409, ERROR_CODE_CONFLICT, 'Waited too long'), true)).toBe(
      'filesGone',
    )
    expect(getConversationSendFailure(new ApiError(409, ERROR_CODE_CONVERSATION_BUSY, 'Busy'), true)).toBe('busy')
    expect(getConversationSendFailure(new TypeError('Failed to fetch'), true)).toBe('error')
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
