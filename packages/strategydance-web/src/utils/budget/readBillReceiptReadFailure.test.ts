import { describe, expect, mock, test } from 'bun:test'

import {
  ERROR_CODE_CONVERSATIONS_SUSPENDED,
  ERROR_CODE_EMAIL_NOT_VERIFIED,
  ERROR_CODE_FORBIDDEN,
  ERROR_CODE_RECEIPT_READS_CAPPED,
  ERROR_CODE_SERVICE_UNAVAILABLE,
  ERROR_CODE_TOO_MANY_REQUESTS,
} from 'strategydance-core'

mock.module('~data/firebase', () => ({ EMULATORS_REQUESTED: true, appCheck: null, authentication: {} }))

const { ApiError } = await import('~data/api')
const { default: readBillReceiptReadFailure } = await import('~utils/budget/readBillReceiptReadFailure')

describe('readBillReceiptReadFailure', () => {
  test('reads a refusal asking again would not change', () => {
    expect(readBillReceiptReadFailure(new ApiError(429, ERROR_CODE_RECEIPT_READS_CAPPED, '', 60_000))).toBe('capped')
    expect(readBillReceiptReadFailure(new ApiError(403, ERROR_CODE_EMAIL_NOT_VERIFIED, ''))).toBe('unverified')
    expect(readBillReceiptReadFailure(new ApiError(403, ERROR_CODE_CONVERSATIONS_SUSPENDED, ''))).toBe('suspended')
  })

  test('reads anything else as a read that failed, which can be asked again', () => {
    expect(readBillReceiptReadFailure(new ApiError(503, ERROR_CODE_SERVICE_UNAVAILABLE, ''))).toBe('failed')
    expect(readBillReceiptReadFailure(new ApiError(429, ERROR_CODE_TOO_MANY_REQUESTS, ''))).toBe('failed')
    expect(readBillReceiptReadFailure(new ApiError(403, ERROR_CODE_FORBIDDEN, ''))).toBe('failed')
    expect(readBillReceiptReadFailure(new TypeError('Failed to fetch'))).toBe('failed')
  })
})
