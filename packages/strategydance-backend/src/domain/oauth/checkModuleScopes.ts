import { type ModuleDefinition, toModuleScopes } from 'strategydance-core'

/*
  Whether scopes are access an address can grant, the rule every consent, token and refresh holds
  to: each scope one of its modules' read or write scope, at least one module's read among them,
  and never a module's write without its read, since a consent offers each module read or read and
  write. A module's own address has one module, so there it is its read, alone or with its write
*/
function checkModuleScopes(modules: readonly ModuleDefinition[], scopes: readonly string[]) {
  const given = new Set(scopes)
  const known = new Set<string>(toModuleScopes(modules))

  return (
    [...given].every(scope => known.has(scope))
    && modules.some(({ scopes: { read } }) => given.has(read))
    && modules.every(({ scopes: { read, write } }) => !given.has(write) || given.has(read))
  )
}

export default checkModuleScopes
