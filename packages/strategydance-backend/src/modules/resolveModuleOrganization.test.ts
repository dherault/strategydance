import { describe, expect, it } from 'bun:test'

import listModuleOrganizations from './listModuleOrganizations'
import resolveModuleOrganization from './resolveModuleOrganization'

const ACME = {
  organizationId: '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f',
  membershipCreatedAt: '2026-10-09T10:00:00.000000Z',
  segment: 'acme-ab12',
  name: 'Acme',
}

const BETA = {
  organizationId: '1a2b3c4d5e6f47089a0b1c2d3e4f5a6b',
  membershipCreatedAt: '2026-10-09T10:00:00.000000Z',
  segment: '1a2b3c4d5e6f47089a0b1c2d3e4f5a6b',
  name: 'Beta',
}

describe('resolveModuleOrganization', () => {
  it('finds an organization by its segment, or by its id in either form and case', () => {
    expect(resolveModuleOrganization([ACME, BETA], 'acme-ab12')).toBe(ACME)
    expect(resolveModuleOrganization([ACME, BETA], '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f')).toBe(ACME)
    expect(resolveModuleOrganization([ACME, BETA], '0F9C2B8E-4B1A-4D2C-9E7F-6A5B4C3D2E1F')).toBe(ACME)
    expect(resolveModuleOrganization([ACME, BETA], '1a2b3c4d-5e6f-4708-9a0b-1c2d3e4f5a6b')).toBe(BETA)
  })

  it('finds nothing it does not reach, nor a slug written otherwise, nor a name', () => {
    expect(resolveModuleOrganization([ACME, BETA], 'gamma-x9k2')).toBeNull()
    expect(resolveModuleOrganization([ACME, BETA], 'ACME-AB12')).toBeNull()
    expect(resolveModuleOrganization([ACME, BETA], ' acme-ab12')).toBeNull()
    expect(resolveModuleOrganization([ACME, BETA], 'Acme')).toBeNull()
    expect(resolveModuleOrganization([ACME], '1a2b3c4d5e6f47089a0b1c2d3e4f5a6b')).toBeNull()
  })
})

describe('listModuleOrganizations', () => {
  it('lists each organization quoted, with its name quoted, joined as a sentence', () => {
    expect(listModuleOrganizations([ACME], 'or')).toBe('"acme-ab12" ("Acme")')
    expect(listModuleOrganizations([ACME, BETA], 'or')).toBe(`"acme-ab12" ("Acme") or "${BETA.segment}" ("Beta")`)
    expect(listModuleOrganizations([ACME, BETA, { ...ACME, segment: 'gamma-x9k2', name: 'Gamma' }], 'and')).toBe(
      `"acme-ab12" ("Acme"), "${BETA.segment}" ("Beta") and "gamma-x9k2" ("Gamma")`,
    )
  })

  it('keeps a name an administrator wrote within its quotes', () => {
    expect(listModuleOrganizations([{ ...ACME, name: 'Acme") or ("anything' }], 'and')).toBe(
      '"acme-ab12" ("Acme\\") or (\\"anything")',
    )
  })
})
