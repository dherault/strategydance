import { describe, expect, it } from 'bun:test'

import buildOrganizationStoragePrefix from './buildOrganizationStoragePrefix'

describe('buildOrganizationStoragePrefix', () => {
  it('writes the same prefix whichever form of the id it is given', () => {
    const prefix = 'organizations/0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f/'

    expect(buildOrganizationStoragePrefix('0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f')).toBe(prefix)
    expect(buildOrganizationStoragePrefix('0F9C2B8E-4B1A-4D2C-9E7F-6A5B4C3D2E1F')).toBe(prefix)
  })

  it('narrows to one kind of picture', () => {
    expect(buildOrganizationStoragePrefix('0f9c2b8e-4b1a-4d2c-9e7f-6a5b4c3d2e1f', 'logo')).toBe('organizations/0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f/logo/')
    expect(buildOrganizationStoragePrefix('0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f', 'banner')).toBe('organizations/0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f/banner/')
  })
})
