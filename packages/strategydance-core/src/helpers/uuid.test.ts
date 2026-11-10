import { describe, expect, it } from 'bun:test'

import { toCanonicalUuid } from './uuid'

describe('toCanonicalUuid', () => {
  it('writes a UUID as Data Connect does, whichever form it came in', () => {
    expect(toCanonicalUuid('0F8FAD5B-D9CB-469F-A165-70867728950E')).toBe('0f8fad5bd9cb469fa16570867728950e')
    expect(toCanonicalUuid('0f8fad5b-d9cb-469f-a165-70867728950e')).toBe('0f8fad5bd9cb469fa16570867728950e')
    expect(toCanonicalUuid('0f8fad5bd9cb469fa16570867728950e')).toBe('0f8fad5bd9cb469fa16570867728950e')
  })
})
