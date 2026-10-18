import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { Request, Response } from 'express'
import { ERROR_CODE_EMAIL_NOT_VERIFIED } from 'strategydance-core'

import { IS_EMAIL_VERIFICATION_REQUIRED } from '~constants'

import verifiedEmailMiddleware from './verifiedEmail'

// What the middleware answered with, when it answered rather than let the request through
let answers: { status: number; code: string }[]

const next = mock(() => {})

function createResponse() {
  let status = 0
  const response = {
    status(code: number) {
      status = code

      return response
    },
    json(body: { code: string }) {
      answers.push({ status, code: body.code })
    },
  }

  return response as unknown as Response
}

function createRequest(isEmailVerified: boolean) {
  return { viewer: { id: 'viewer', email: 'viewer@example.com', isEmailVerified } } as Request
}

beforeEach(() => {
  answers = []
  next.mockClear()
})

describe('verifiedEmailMiddleware', () => {
  test('holds everywhere but the development backend, the tests included', () => {
    expect(IS_EMAIL_VERIFICATION_REQUIRED).toBe(true)
  })

  test('lets through a caller whose token says their address is confirmed', () => {
    verifiedEmailMiddleware(createRequest(true), createResponse(), next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(answers).toEqual([])
  })

  test('answers 403 to a caller whose token does not', () => {
    verifiedEmailMiddleware(createRequest(false), createResponse(), next)

    expect(answers).toEqual([{ status: 403, code: ERROR_CODE_EMAIL_NOT_VERIFIED }])
    expect(next).not.toHaveBeenCalled()
  })
})
