import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { Request, Response } from 'express'

// What the ID token verifies to, or null for a token that fails verification
let decoded: Record<string, unknown> | null

mock.module('~firebase', () => ({
  authentication: {
    verifyIdToken: async () => {
      if (!decoded) throw new Error('Invalid token')

      return decoded
    },
  },
}))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

const { default: authenticationMiddleware } = await import('./authentication')

// The statuses the middleware answered with, when it answered rather than let the request through
let statuses: number[]

const next = mock(() => {})

function createResponse() {
  const response = {
    status(code: number) {
      statuses.push(code)

      return response
    },
    json() {},
  }

  return response as unknown as Response
}

function createRequest(authorization: string | undefined) {
  return { header: () => authorization } as unknown as Request
}

beforeEach(() => {
  decoded = null
  statuses = []
  next.mockClear()
})

describe('authenticationMiddleware', () => {
  test('keeps who is calling, and whether their token says the address is confirmed', async () => {
    for (const [claim, isEmailVerified] of [
      [true, true],
      [false, false],
      [undefined, false],
    ] as const) {
      decoded = {
        uid: 'viewer',
        email: 'viewer@example.com',
        ...(claim === undefined ? {} : { email_verified: claim }),
      }
      const request = createRequest('Bearer token')

      await authenticationMiddleware(request, createResponse(), next)

      expect(request.viewer).toEqual({ id: 'viewer', email: 'viewer@example.com', isEmailVerified })
    }

    expect(next).toHaveBeenCalledTimes(3)
    expect(statuses).toEqual([])
  })

  test('keeps no address when the token carries none', async () => {
    decoded = { uid: 'viewer' }
    const request = createRequest('Bearer token')

    await authenticationMiddleware(request, createResponse(), next)

    expect(request.viewer).toEqual({ id: 'viewer', email: null, isEmailVerified: false })
  })

  test('answers 401 to a request with no token, or one that fails verification', async () => {
    await authenticationMiddleware(createRequest(undefined), createResponse(), next)
    await authenticationMiddleware(createRequest('Bearer token'), createResponse(), next)

    expect(statuses).toEqual([401, 401])
    expect(next).not.toHaveBeenCalled()
  })
})
