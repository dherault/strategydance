import { describe, expect, it } from 'bun:test'

import isAuthenticationPath from './isAuthenticationPath'

describe('isAuthenticationPath', () => {
  it('knows the sign-in screens, whatever their case', () => {
    expect(isAuthenticationPath('/authentication')).toBe(true)
    expect(isAuthenticationPath('/authentication/')).toBe(true)
    expect(isAuthenticationPath('/authentication/password-reset')).toBe(true)
    expect(isAuthenticationPath('/Authentication')).toBe(true)
  })

  it('knows every other page for what it is', () => {
    expect(isAuthenticationPath('/')).toBe(false)
    expect(isAuthenticationPath('/today')).toBe(false)
    expect(isAuthenticationPath('/authentications')).toBe(false)
    expect(isAuthenticationPath('/team/authentication')).toBe(false)
  })
})
