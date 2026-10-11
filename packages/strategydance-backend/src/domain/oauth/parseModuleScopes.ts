import type { ModuleDefinition, ModuleScope } from 'strategydance-core'

/*
  The scopes an authorization asks of a module: its read scope, alone or with its write scope,
  since a consent offers read or read and write and write never comes without read. A request naming
  no scope asks for both. Null for a scope past the module's, or write without read. Answered in the
  module's order, read first
*/
function parseModuleScopes(module: ModuleDefinition, scope: string | undefined): ModuleScope[] | null {
  const read = module.scopes.read as ModuleScope
  const write = module.scopes.write as ModuleScope

  if (!scope) return [read, write]

  const asked = new Set(scope.split(' ').filter(Boolean))

  if (!asked.has(read) || [...asked].some(name => name !== read && name !== write)) return null

  return asked.has(write) ? [read, write] : [read]
}

export default parseModuleScopes
