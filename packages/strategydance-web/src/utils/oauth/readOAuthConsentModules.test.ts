import { describe, expect, it } from 'bun:test'

import type { ModuleName, ModuleScope } from 'strategydance-core'

import readOAuthConsentModules, { type OAuthConsentAccessLevel } from './readOAuthConsentModules'
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

// A module as the page lists it: whether write is offered, where it starts, and what the agent asked
// for beyond that, which the page marks
function listed(
  name: ModuleName,
  isWriteOffered: boolean,
  initialAccess: OAuthConsentAccessLevel,
  askedAccess: 'read' | 'write' | null = null,
) {
  return { name, isWriteOffered, initialAccess, askedAccess }
}

describe('readOAuthConsentModules', () => {
  it('starts each module asked for on a first consent as asked, in `MODULES` order', () => {
    expect(atOneAddress(['tasks:read', 'tasks:write', 'documents:read'])).toEqual([
      listed('documents', false, 'read'),
      listed('tasks', true, 'write'),
    ])
  })

  it('lists the modules the connection replaced holds beside those asked for, held as they were', () => {
    expect(atOneAddress(['documents:read'], ['documents:read', 'documents:write', 'tasks:read'])).toEqual([
      listed('documents', true, 'write'),
      listed('tasks', false, 'read'),
    ])
  })

  it('starts a write held at read at read when a challenge asks for it, marking the write asked for', () => {
    // The challenge for a Tasks write names the connection's scopes with tasks:write
    expect(atOneAddress(['documents:read', 'tasks:read', 'tasks:write'], ['documents:read', 'tasks:read'])).toEqual([
      listed('documents', false, 'read'),
      listed('tasks', true, 'read', 'write'),
    ])
  })

  it('starts a module the connection does not hold not allowed on consenting again, marking what was asked', () => {
    // A client asking for Tasks alone beside the Documents its connection holds
    expect(atOneAddress(['tasks:read'], ['documents:read', 'documents:write'])).toEqual([
      listed('documents', true, 'write'),
      listed('tasks', false, 'none', 'read'),
    ])
    // A client asking every scope again, as one whose refresh token expired does, after the member
    // left Tasks and Budget out
    expect(atOneAddress(ALL, ['documents:read', 'documents:write'])).toEqual([
      listed('documents', true, 'write'),
      listed('tasks', true, 'none', 'write'),
      listed('budget', true, 'none', 'write'),
    ])
    // A first consent starts each module with what was asked, Budget at read
    expect(atOneAddress(ALL)).toEqual([
      listed('documents', true, 'write'),
      listed('tasks', true, 'write'),
      listed('budget', true, 'read', 'write'),
    ])
  })

  it('starts Budget at read unless its write was asked for and held, offering the write it was asked or held', () => {
    const budget = (scopes: ModuleScope[], held: ModuleScope[] = []) =>
      atOneAddress(scopes, held).find(({ name }) => name === 'budget')

    expect(budget(ALL)).toEqual(listed('budget', true, 'read', 'write'))
    expect(budget(ALL, ['budget:read'])).toEqual(listed('budget', true, 'read', 'write'))
    expect(budget(ALL, ['documents:read'])).toEqual(listed('budget', true, 'none', 'write'))
    expect(budget(['tasks:read'], ['budget:read', 'budget:write'])).toEqual(listed('budget', true, 'read'))
    expect(budget(ALL, ['budget:read', 'budget:write'])).toEqual(listed('budget', true, 'write'))
  })

  it('starts a module as held, or as asked when that is more, at its own address, a consent of its own', () => {
    expect(
      readOAuthConsentModules({ address: 'budget', scopes: ['budget:read', 'budget:write'], heldScopes: [] }),
    ).toEqual([listed('budget', true, 'write')])
    expect(
      readOAuthConsentModules({ address: 'tasks', scopes: ['tasks:read', 'tasks:write'], heldScopes: ['tasks:read'] }),
    ).toEqual([listed('tasks', true, 'write')])
  })

  it("lists a module's own address's module alone, and nothing of a scope its address does not serve", () => {
    expect(
      readOAuthConsentModules({ address: 'tasks', scopes: ['tasks:read'], heldScopes: ['documents:read'] }),
    ).toEqual([listed('tasks', false, 'read')])
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
