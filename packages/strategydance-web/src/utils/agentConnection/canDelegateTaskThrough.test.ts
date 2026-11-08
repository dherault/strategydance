import { describe, expect, it } from 'bun:test'

import canDelegateTaskThrough from './canDelegateTaskThrough'

const ACME = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const BETA = '1a2b3c4d5e6f47089a0b1c2d3e4f5a6b'

function connection(module: string, scopes: string[], organizationIds = [ACME]) {
  return { module, scopes, organizations: organizationIds.map(id => ({ id })) }
}

describe('canDelegateTaskThrough', () => {
  it("takes a connection to the Tasks module's own address reaching the task's organization", () => {
    expect(canDelegateTaskThrough(connection('tasks', ['tasks:read']), ACME)).toBe(true)
    expect(canDelegateTaskThrough(connection('tasks', ['tasks:read'], [BETA]), ACME)).toBe(false)
  })

  it("takes a connection at the one address holding the board's read in the task's organization", () => {
    expect(canDelegateTaskThrough(connection('strategydance', ['documents:read', 'tasks:read']), ACME)).toBe(true)
    expect(canDelegateTaskThrough(connection('strategydance', ['documents:read', 'documents:write']), ACME)).toBe(false)
    expect(canDelegateTaskThrough(connection('strategydance', ['tasks:read'], [BETA]), ACME)).toBe(false)
  })

  it('refuses another module, and an organization nobody has open', () => {
    expect(canDelegateTaskThrough(connection('documents', ['documents:read']), ACME)).toBe(false)
    expect(canDelegateTaskThrough(connection('tasks', ['tasks:read']), undefined)).toBe(false)
  })
})
