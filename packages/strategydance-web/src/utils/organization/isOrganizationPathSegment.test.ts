import { describe, expect, it } from 'bun:test'

import isOrganizationPathSegment from './isOrganizationPathSegment'

describe('isOrganizationPathSegment', () => {
  it('accepts a slug, and an id for an organization that has none yet', () => {
    expect(isOrganizationPathSegment('strategy-dance-ad34')).toBe(true)
    expect(isOrganizationPathSegment('0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f')).toBe(true)
  })

  it('refuses anything else, so it stays a page that does not exist', () => {
    for (const value of ['legl', 'today', 'team', 'Strategy-Dance-AD34', '0f9c2b8e-4b1a-4d2c-9e7f-6a5b4c3d2e1f', '']) {
      expect(isOrganizationPathSegment(value)).toBe(false)
    }
  })
})
