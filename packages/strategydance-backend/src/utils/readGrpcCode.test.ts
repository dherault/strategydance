import { describe, expect, test } from 'bun:test'

import { Status } from 'google-gax'

import readGrpcCode from './readGrpcCode'

describe('readGrpcCode', () => {
  test('reads the code a Google Cloud client’s error carries', () => {
    expect(readGrpcCode(Object.assign(new Error('Exists'), { code: Status.ALREADY_EXISTS }))).toBe(
      Status.ALREADY_EXISTS,
    )
  })

  test('answers null for an error without a numeric code, or something that is no error', () => {
    expect(readGrpcCode(new Error('Socket closed'))).toBeNull()
    expect(readGrpcCode(Object.assign(new Error('Reset'), { code: 'ECONNRESET' }))).toBeNull()
    expect(readGrpcCode('unavailable')).toBeNull()
    expect(readGrpcCode(null)).toBeNull()
  })
})
