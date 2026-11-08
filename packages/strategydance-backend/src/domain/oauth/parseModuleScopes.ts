import { type ModuleDefinition, type ModuleScope, toModuleScopesInOrder } from 'strategydance-core'

import checkModuleScopes from '~domain/oauth/checkModuleScopes'

/*
  The scopes an authorization asks of an address's modules: for each, its read scope, alone or with
  its write scope, or neither, at least one module read, since a consent offers each module read or
  read and write and write never comes without read. A request naming no scope asks for every
  module's read and write. Null for a scope of no module the address serves, write without read, or
  no read at all. Answered in `MODULES`' order, each module's read first
*/
function parseModuleScopes(modules: readonly ModuleDefinition[], scope: string | undefined): ModuleScope[] | null {
  if (!scope) return toModuleScopesInOrder(modules.flatMap(({ scopes: { read, write } }) => [read, write]))

  const asked = scope.split(' ').filter(Boolean)

  return checkModuleScopes(modules, asked) ? toModuleScopesInOrder(asked) : null
}

export default parseModuleScopes
