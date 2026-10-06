import { describe, expect, it } from 'bun:test'

import buildOrganizationSwitchPath from './buildOrganizationSwitchPath'

describe('buildOrganizationSwitchPath', () => {
  it('keeps the page, in the other organization', () => {
    expect(buildOrganizationSwitchPath('/acme-ab12/today', 'globex-cd34')).toBe('/globex-cd34/today')
    expect(buildOrganizationSwitchPath('/acme-ab12/team', 'globex-cd34')).toBe('/globex-cd34/team')
    expect(buildOrganizationSwitchPath('/acme-ab12/aspects/legal', 'globex-cd34')).toBe('/globex-cd34/aspects/legal')
  })

  it("goes back to the list from a document or a conversation, which are the organization's own", () => {
    expect(buildOrganizationSwitchPath('/acme-ab12/knowledge/0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f', 'globex-cd34')).toBe(
      '/globex-cd34/knowledge',
    )
    expect(
      buildOrganizationSwitchPath('/acme-ab12/conversations/0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f', 'globex-cd34'),
    ).toBe('/globex-cd34/conversations')
    expect(buildOrganizationSwitchPath('/acme-ab12/knowledge/', 'globex-cd34')).toBe('/globex-cd34/knowledge')
  })

  it("leads to today from the organization's own address", () => {
    expect(buildOrganizationSwitchPath('/acme-ab12', 'globex-cd34')).toBe('/globex-cd34/today')
    expect(buildOrganizationSwitchPath('/acme-ab12/', 'globex-cd34')).toBe('/globex-cd34/today')
  })

  it('swaps an id for a slug, and a slug for an id', () => {
    expect(buildOrganizationSwitchPath('/0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f/team', 'globex-cd34')).toBe(
      '/globex-cd34/team',
    )
    expect(buildOrganizationSwitchPath('/acme-ab12/team', '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f')).toBe(
      '/0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f/team',
    )
  })
})
