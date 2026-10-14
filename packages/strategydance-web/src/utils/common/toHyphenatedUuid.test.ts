import { describe, expect, it } from 'bun:test'

import toHyphenatedUuid from '~utils/common/toHyphenatedUuid'

describe('toHyphenatedUuid', () => {
  it('hyphenates a UUID Data Connect wrote, and keeps a hyphenated one as it is', () => {
    expect(toHyphenatedUuid('7C9E6679742540DE944BE07FC1F90AE7')).toBe('7c9e6679-7425-40de-944b-e07fc1f90ae7')
    expect(toHyphenatedUuid('7c9e6679-7425-40de-944b-e07fc1f90ae7')).toBe('7c9e6679-7425-40de-944b-e07fc1f90ae7')
  })
})
