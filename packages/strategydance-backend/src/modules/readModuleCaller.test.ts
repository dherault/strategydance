import { describe, expect, it } from 'bun:test'

import type { ModuleCaller } from '~types'

import readModuleCaller from './readModuleCaller'
import toModuleAuthInfo from './toModuleAuthInfo'

const CALLER: ModuleCaller = {
  kind: 'external',
  userId: 'member',
  organizationId: '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f',
  membershipCreatedAt: '2026-10-09T10:00:00.000000Z',
  scopes: ['knowledge:read'],
  idempotencyScope: 'connection:checked',
}

describe('readModuleCaller', () => {
  it('reads back the caller toModuleAuthInfo carried', () => {
    expect(readModuleCaller(toModuleAuthInfo(CALLER))).toEqual(CALLER)
  })

  it('carries the scopes and whatever an access token says beside the caller', () => {
    const resource = new URL('https://api.strategydance.com/mcp/knowledge')
    const authInfo = toModuleAuthInfo(CALLER, { token: 'token', clientId: 'client', expiresAt: 1, resource })

    expect(authInfo).toMatchObject({
      token: 'token',
      clientId: 'client',
      expiresAt: 1,
      resource,
      scopes: ['knowledge:read'],
    })
  })

  it('refuses a request that carries no caller, or one it did not write', () => {
    expect(() => readModuleCaller(undefined)).toThrow()
    expect(() => readModuleCaller({ token: 't', clientId: 'c', scopes: [] })).toThrow()
    expect(() =>
      readModuleCaller({ token: 't', clientId: 'c', scopes: [], extra: { caller: { ...CALLER, scopes: ['admin'] } } }),
    ).toThrow()
  })
})
