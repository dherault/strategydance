import { describe, expect, it } from 'bun:test'

import isAdministratorRefusal from './isAdministratorRefusal'

describe('isAdministratorRefusal', () => {
  it('reads a demoted or removed caller as refused', () => {
    expect(isAdministratorRefusal(new Error('Only an administrator can change an organization\'s logo (aborted)\n(rolled back) (aborted)'))).toBe(true)
    expect(isAdministratorRefusal(new Error('Only a member of an organization can delete it (aborted)'))).toBe(true)
  })

  it('reads anything else as not a refusal, even with a refusal on a later line', () => {
    expect(isAdministratorRefusal(new Error('The organization is gone (aborted)\nOnly an administrator can delete an organization (aborted)'))).toBe(false)
    expect(isAdministratorRefusal(new Error('fetch failed'))).toBe(false)
    expect(isAdministratorRefusal('timeout')).toBe(false)
  })
})
