import { MODULES, type ModuleName, readModuleAddress } from 'strategydance-core'

// What a connection may do in one module: read, or read and write
type ModuleAccess = { name: ModuleName; isWrite: boolean }

export type AgentConnectionAccess =
  // A connection at the one address, and the modules it holds there, in `MODULES`' order
  | { kind: 'address'; modules: ModuleAccess[] }
  // A connection at a module's own address, or to a module served at no address any more
  | ({ kind: 'module' } & ModuleAccess)
  // A connection whose address no release here knows, which the row names as it is
  | { kind: 'unknown'; name: string }

/*
  What a connected agent may do, as the Connected agents tab words it: at the one address, each
  module it holds, read or read and write, and none it does not; at a module's own address, that
  module. A connection's `module` holds its address's name, `strategydance` for the one address
*/
function readAgentConnectionAccess({
  module,
  scopes,
}: {
  module: string
  scopes: readonly string[]
}): AgentConnectionAccess {
  const address = readModuleAddress(module)

  if (address && address.modules.length > 1) {
    return {
      kind: 'address',
      modules: MODULES.filter(
        ({ name, scopes: { read } }) => address.modules.includes(name) && scopes.includes(read),
      ).map(({ name, scopes: { write } }) => ({ name, isWrite: scopes.includes(write) })),
    }
  }

  const definition = MODULES.find(({ name }) => name === module)

  if (!definition) return { kind: 'unknown', name: module }

  return { kind: 'module', name: definition.name, isWrite: scopes.includes(definition.scopes.write) }
}

export default readAgentConnectionAccess
