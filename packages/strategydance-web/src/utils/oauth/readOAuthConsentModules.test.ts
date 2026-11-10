import { describe, expect, it } from 'bun:test'

import type { ModuleScope } from 'strategydance-core'

import readOAuthConsentModules from './readOAuthConsentModules'
import toOAuthConsentScopes from './toOAuthConsentScopes'

const ALL: ModuleScope[] = [
  'documents:read',
  'documents:write',
  'tasks:read',
  'tasks:write',
  'budget:read',
  'budget:write',
]

function atOneAddress(scopes: ModuleScope[], heldScopes: ModuleScope[] = []) {
  return readOAuthConsentModules({ address: 'strategydance', scopes, heldScopes })
}

describe('readOAuthConsentModules', () => {
  it('lists each module asked for, read and write when asked, in `MODULES` order', () => {
    expect(atOneAddress(['tasks:read', 'tasks:write', 'documents:read'])).toEqual([
      { name: 'documents', isWriteOffered: false, initialAccess: 'read' },
      { name: 'tasks', isWriteOffered: true, initialAccess: 'write' },
    ])
  })

  it('lists the modules the connection replaced holds beside those asked for, kept as they were', () => {
    expect(atOneAddress(['tasks:read'], ['documents:read', 'documents:write'])).toEqual([
      { name: 'documents', isWriteOffered: true, initialAccess: 'write' },
      { name: 'tasks', isWriteOffered: false, initialAccess: 'read' },
    ])
  })

  it('starts a module held as held, its write offered when asked', () => {
    expect(atOneAddress(['documents:read'], ['documents:read', 'documents:write'])).toEqual([
      { name: 'documents', isWriteOffered: true, initialAccess: 'write' },
    ])
    expect(atOneAddress(['documents:read', 'documents:write'], ['documents:read'])).toEqual([
      { name: 'documents', isWriteOffered: true, initialAccess: 'read' },
    ])
  })

  it('starts a write held at read at read when a challenge asks for it, and a module only asked for as asked', () => {
    // The challenge for a Tasks write names the connection's scopes with tasks:write
    expect(atOneAddress(['documents:read', 'tasks:read', 'tasks:write'], ['documents:read', 'tasks:read'])).toEqual([
      { name: 'documents', isWriteOffered: false, initialAccess: 'read' },
      { name: 'tasks', isWriteOffered: true, initialAccess: 'read' },
    ])
    expect(atOneAddress(['documents:read', 'tasks:read', 'tasks:write'], ['documents:read'])).toEqual([
      { name: 'documents', isWriteOffered: false, initialAccess: 'read' },
      { name: 'tasks', isWriteOffered: true, initialAccess: 'write' },
    ])
  })

  it('starts Budget at read unless its write was asked for and held, offering the write it was asked or held', () => {
    const budget = (scopes: ModuleScope[], held: ModuleScope[] = []) =>
      atOneAddress(scopes, held).find(({ name }) => name === 'budget')

    expect(budget(ALL)).toEqual({ name: 'budget', isWriteOffered: true, initialAccess: 'read' })
    expect(budget(ALL, ['budget:read'])).toEqual({ name: 'budget', isWriteOffered: true, initialAccess: 'read' })
    expect(budget(['tasks:read'], ['budget:read', 'budget:write'])).toEqual({
      name: 'budget',
      isWriteOffered: true,
      initialAccess: 'read',
    })
    expect(budget(ALL, ['budget:read', 'budget:write'])).toEqual({
      name: 'budget',
      isWriteOffered: true,
      initialAccess: 'write',
    })
  })

  it('starts a module as held, or as asked when that is more, at its own address, a consent of its own', () => {
    expect(
      readOAuthConsentModules({ address: 'budget', scopes: ['budget:read', 'budget:write'], heldScopes: [] }),
    ).toEqual([{ name: 'budget', isWriteOffered: true, initialAccess: 'write' }])
    expect(
      readOAuthConsentModules({ address: 'tasks', scopes: ['tasks:read', 'tasks:write'], heldScopes: ['tasks:read'] }),
    ).toEqual([{ name: 'tasks', isWriteOffered: true, initialAccess: 'write' }])
  })

  it("lists a module's own address's module alone, and nothing of a scope its address does not serve", () => {
    expect(
      readOAuthConsentModules({ address: 'tasks', scopes: ['tasks:read'], heldScopes: ['documents:read'] }),
    ).toEqual([{ name: 'tasks', isWriteOffered: false, initialAccess: 'read' }])
    expect(readOAuthConsentModules({ address: 'knowledge', scopes: ['knowledge:read'], heldScopes: [] })).toEqual([])
  })
})

describe('toOAuthConsentScopes', () => {
  it("names each module's access chosen in `MODULES` order, and nothing for a module not allowed", () => {
    expect(toOAuthConsentScopes({ tasks: 'write', budget: 'none', documents: 'read' })).toEqual([
      'documents:read',
      'tasks:read',
      'tasks:write',
    ])
    expect(toOAuthConsentScopes({ documents: 'none' })).toEqual([])
  })
})
