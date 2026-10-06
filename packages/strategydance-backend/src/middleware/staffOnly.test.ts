import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { Request, Response } from 'express'

// The account's row as the database reads it, or null for none
let user: { isAdministrator: boolean } | null

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('strategydance-database/backend', () => ({
  getUserStaffStatus: async () => ({ data: { user } }),
}))

const { default: staffOnlyMiddleware } = await import('./staffOnly')

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

const request = { viewer: { id: 'viewer', email: null } } as Request

beforeEach(() => {
  user = null
  statuses = []
  next.mockClear()
})

describe('staffOnlyMiddleware', () => {
  test('lets Strategy Dance’s administrators through', async () => {
    user = { isAdministrator: true }

    await staffOnlyMiddleware(request, createResponse(), next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(statuses).toEqual([])
  })

  test('answers 403 to anybody else, and to an account with no row', async () => {
    for (const reader of [{ isAdministrator: false }, null]) {
      user = reader

      await staffOnlyMiddleware(request, createResponse(), next)
    }

    expect(statuses).toEqual([403, 403])
    expect(next).not.toHaveBeenCalled()
  })
})
