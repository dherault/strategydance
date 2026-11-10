import { type ModuleDefinition, type ModuleScope, toModuleScopes, toModuleScopesInOrder } from 'strategydance-core'

// What a connection holds of an address's modules, in `MODULES`' order: the access consenting again
// there keeps unless the member changes it, and none of a module the address no longer serves
function readHeldScopes(modules: readonly ModuleDefinition[], scopes: readonly string[]): ModuleScope[] {
  const served = new Set(toModuleScopes(modules))

  return toModuleScopesInOrder(scopes).filter(scope => served.has(scope))
}

export default readHeldScopes
