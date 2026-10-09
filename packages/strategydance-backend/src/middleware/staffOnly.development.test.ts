import { describe, expect, mock, test } from 'bun:test'

import type { Request, Response } from 'express'

const getUserStaffStatus = mock(async () => ({ data: { user: { isAdministrator: false } } }))

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('strategydance-database/backend', () => ({ getUserStaffStatus }))

// The development backend, as `bun run dev:backend` starts it. The environment is the process's,
// which the next test file shares, so it is put back once the constants have read it
const environment = process.env.NODE_ENV

process.env.NODE_ENV = 'development'

const { IS_CONVERSATIONS_RELEASE_GATED } = await import('~constants')
const { default: staffOnlyMiddleware } = await import('./staffOnly')

process.env.NODE_ENV = environment

describe('staffOnlyMiddleware on the development backend', () => {
  test('lets everybody through, staff or not, without reading their account', async () => {
    const next = mock(() => {})

    await staffOnlyMiddleware({ viewer: { id: 'viewer', email: null } } as Request, {} as Response, next)

    expect(IS_CONVERSATIONS_RELEASE_GATED).toBe(false)
    expect(next).toHaveBeenCalledTimes(1)
    expect(getUserStaffStatus).not.toHaveBeenCalled()
  })
})
