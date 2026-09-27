import { describe, expect, it } from 'bun:test'

import parseRedirectPath from './parseRedirectPath'

describe('parseRedirectPath', () => {
  it('keeps a page of the site, its query included', () => {
    expect(parseRedirectPath('/team')).toBe('/team')
    expect(parseRedirectPath('/invitation/5febe4d9f66a4422967941b41d5e6589')).toBe('/invitation/5febe4d9f66a4422967941b41d5e6589')
    expect(parseRedirectPath('/explore?tab=all')).toBe('/explore?tab=all')
    expect(parseRedirectPath('/aspects/legal')).toBe('/aspects/legal')
  })

  it('drops the sign-in screens, whatever their case', () => {
    expect(parseRedirectPath('/authentication')).toBeNull()
    expect(parseRedirectPath('/authentication/password-reset')).toBeNull()
    expect(parseRedirectPath('/authentication?redirect=/team')).toBeNull()
    expect(parseRedirectPath('/Authentication')).toBeNull()
  })

  it('checks the path the browser would land on, dot segments resolved', () => {
    expect(parseRedirectPath('/team/../authentication')).toBeNull()
    expect(parseRedirectPath('/team/%2e%2e/authentication')).toBeNull()
    expect(parseRedirectPath('/team/../explore')).toBe('/explore')
  })

  it('drops what a browser could read as another host', () => {
    expect(parseRedirectPath('https://evil.example/team')).toBeNull()
    expect(parseRedirectPath('//evil.example/team')).toBeNull()
    expect(parseRedirectPath('/\\evil.example/team')).toBeNull()
    expect(parseRedirectPath('/team//evil.example')).toBeNull()
    expect(parseRedirectPath('/team/\\evil.example')).toBeNull()
  })

  it('drops what is not a path', () => {
    expect(parseRedirectPath(undefined)).toBeNull()
    expect(parseRedirectPath(['/team'])).toBeNull()
    expect(parseRedirectPath('team')).toBeNull()
  })
})
