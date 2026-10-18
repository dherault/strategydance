import { describe, expect, mock, test } from 'bun:test'

import type { Request, Response } from 'express'

// The development backend, as `bun run dev:backend` starts it. The environment is the process's,
// which the next test file shares, so it is put back once the constants have read it
const environment = { nodeEnvironment: process.env.NODE_ENV, required: process.env.EMAIL_VERIFICATION_REQUIRED }

process.env.NODE_ENV = 'development'
delete process.env.EMAIL_VERIFICATION_REQUIRED

const { IS_EMAIL_VERIFICATION_REQUIRED } = await import('~constants')
const { default: verifiedEmailMiddleware } = await import('./verifiedEmail')

process.env.NODE_ENV = environment.nodeEnvironment
if (environment.required !== undefined) process.env.EMAIL_VERIFICATION_REQUIRED = environment.required

describe('verifiedEmailMiddleware on the development backend', () => {
  // Its Auth emulator confirms no address by itself
  test('lets everybody through, their address confirmed or not', () => {
    const next = mock(() => {})

    verifiedEmailMiddleware(
      { viewer: { id: 'viewer', email: null, isEmailVerified: false } } as Request,
      {} as Response,
      next,
    )

    expect(IS_EMAIL_VERIFICATION_REQUIRED).toBe(false)
    expect(next).toHaveBeenCalledTimes(1)
  })
})
