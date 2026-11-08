import { type ModuleDefinition, type ModuleScope, toModuleScopesInOrder } from 'strategydance-core'

// What a connection holds of an address's modules, in `MODULES`' order: the access consenting again
// there keeps unless the member changes it, and none of a module the address no longer serves
function readHeldScopes(modules: readonly ModuleDefinition[], scopes: readonly string[]): ModuleScope[] {
  const served = new Set(modules.flatMap(({ scopes: { read, write } }) => [read, write]))

  return toModuleScopesInOrder(scopes).filter(scope => served.has(scope))
}

export default readHeldScopes
