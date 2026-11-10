import { MODULE_ADDRESSES, MODULES } from '../constants'
import type { ModuleAddress, ModuleDefinition, ModuleScope } from '../types'

// The address of `MODULE_ADDRESSES` a name names, as a connection's `module` holds it, or nothing
export function readModuleAddress(name: string): ModuleAddress | undefined {
  return MODULE_ADDRESSES.find(address => address.name === name)
}

// The scopes the modules given grant: each one's read then write, in the order given
export function toModuleScopes(modules: readonly ModuleDefinition[]): ModuleScope[] {
  return modules.flatMap(({ scopes: { read, write } }) => [read, write] as ModuleScope[])
}

/*
  The scopes among those given that one of `MODULES` grants, each once, in `MODULES`' order, each
  module's read before its write: the one order a grant, a challenge and an answer name them in,
  whatever order they came in
*/
export function toModuleScopesInOrder(scopes: Iterable<string>): ModuleScope[] {
  const given = new Set(scopes)

  return toModuleScopes(MODULES).filter(scope => given.has(scope))
}

// The modules an address serves, as `MODULES` defines them, in its order
export function readModuleAddressModules(address: ModuleAddress) {
  return MODULES.filter(({ name }) => address.modules.includes(name))
}

// An address's scopes: each of its modules' read then write scope, in `MODULES`' order, what its
// protected resource metadata lists and a consent there may grant
export function readModuleAddressScopes(address: ModuleAddress): ModuleScope[] {
  return toModuleScopes(readModuleAddressModules(address))
}
