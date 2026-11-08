import { describe, expect, it } from 'bun:test'

import { MODULE_ADDRESSES, MODULES_ADDRESS, SERVED_MODULE_NAMES, SERVED_MODULES } from '../constants'

import { readModuleAddress, readModuleAddressScopes, toModuleScopesInOrder } from './moduleAddress'

describe('MODULE_ADDRESSES', () => {
  it('serves every served module at the one address first, then each at its own', () => {
    expect(MODULE_ADDRESSES[0]).toBe(MODULES_ADDRESS)
    expect(MODULES_ADDRESS).toEqual({
      name: 'strategydance',
      path: '/mcp',
      title: 'Strategy Dance',
      modules: SERVED_MODULE_NAMES,
    })
    expect(MODULE_ADDRESSES.slice(1)).toEqual(
      SERVED_MODULES.map(({ name, path, title }) => ({ name, path, title, modules: [name] })),
    )
  })

  it('gives each address a name and a path of its own', () => {
    expect(new Set(MODULE_ADDRESSES.map(({ name }) => name)).size).toBe(MODULE_ADDRESSES.length)
    expect(new Set(MODULE_ADDRESSES.map(({ path }) => path)).size).toBe(MODULE_ADDRESSES.length)
  })
})

describe('readModuleAddress', () => {
  it('finds an address by its name, and nothing for a module served at no address', () => {
    expect(readModuleAddress('strategydance')).toBe(MODULES_ADDRESS)
    expect(readModuleAddress('tasks')?.path).toBe('/mcp/tasks')
    expect(readModuleAddress('knowledge')).toBeUndefined()
    expect(readModuleAddress('')).toBeUndefined()
  })
})

describe('readModuleAddressScopes', () => {
  it("lists each module's read then write, in `MODULES`' order", () => {
    expect(readModuleAddressScopes(MODULES_ADDRESS)).toEqual([
      'documents:read',
      'documents:write',
      'tasks:read',
      'tasks:write',
      'budget:read',
      'budget:write',
    ])
    expect(readModuleAddressScopes(readModuleAddress('budget')!)).toEqual(['budget:read', 'budget:write'])
  })
})

describe('toModuleScopesInOrder', () => {
  it('orders module scopes as `MODULES` does, each once, leaving out anything else', () => {
    expect(toModuleScopesInOrder(['tasks:write', 'documents:read', 'tasks:read', 'tasks:read', 'openid'])).toEqual([
      'documents:read',
      'tasks:read',
      'tasks:write',
    ])
    expect(toModuleScopesInOrder([])).toEqual([])
  })
})
