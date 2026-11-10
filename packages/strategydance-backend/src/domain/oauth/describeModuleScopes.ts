import type { ModuleDefinition } from 'strategydance-core'

/*
  The access an address takes, in the words a refusal names it with: a module's own address its
  read, alone or with its write; an address of several, at least one module's read, each alone or
  with its write
*/
function describeModuleScopes(modules: readonly ModuleDefinition[]) {
  const [module] = modules

  if (modules.length === 1 && module) return `${module.scopes.read}, alone or with ${module.scopes.write}`

  return `at least one of ${modules.map(({ scopes }) => scopes.read).join(', ')}, each alone or with its module's write scope`
}

export default describeModuleScopes
