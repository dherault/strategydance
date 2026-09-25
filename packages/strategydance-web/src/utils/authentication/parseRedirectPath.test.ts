import { describe, expect, it } from 'bun:test'

import parseRedirectPath from './parseRedirectPath'

describe('parseRedirectPath', () => {
  it('keeps a page of the authenticated area, its query included', () => {
    expect(parseRedirectPath('/-/team')).toBe('/-/team')
    expect(parseRedirectPath('/-/invitation/5febe4d9f66a4422967941b41d5e6589')).toBe('/-/invitation/5febe4d9f66a4422967941b41d5e6589')
    expect(parseRedirectPath('/-/explore?tab=all')).toBe('/-/explore?tab=all')
  })

  it('drops anything outside the authenticated area', () => {
    expect(parseRedirectPath('/')).toBeNull()
    expect(parseRedirectPath('/-')).toBeNull()
    expect(parseRedirectPath('/authentication')).toBeNull()
  })

  it('checks the path the browser would land on, dot segments resolved', () => {
    expect(parseRedirectPath('/-/../authentication')).toBeNull()
    expect(parseRedirectPath('/-/%2e%2e/authentication')).toBeNull()
    expect(parseRedirectPath('/-/team/../explore')).toBe('/-/explore')
  })

  it('drops what a browser could read as another host', () => {
    expect(parseRedirectPath('https://evil.example/-/team')).toBeNull()
    expect(parseRedirectPath('//evil.example/-/team')).toBeNull()
    expect(parseRedirectPath('/\\evil.example/-/team')).toBeNull()
    expect(parseRedirectPath('/-//evil.example')).toBeNull()
    expect(parseRedirectPath('/-/\\evil.example')).toBeNull()
  })

  it('drops what is not a path', () => {
    expect(parseRedirectPath(undefined)).toBeNull()
    expect(parseRedirectPath(['/-/team'])).toBeNull()
    expect(parseRedirectPath('-/team')).toBeNull()
  })
})
