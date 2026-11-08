import type { ScopeChallengeHandler } from '@modelcontextprotocol/server'
import type { ModuleDefinition } from 'strategydance-core'

import readModuleAccess from '~modules/readModuleAccess'
import toModuleScopeChallenge from '~modules/toModuleScopeChallenge'

/*
  What every write tool of a module registers as its `scopeChallenge`: a call from a connection
  granted the module's read alone answers 403, `insufficient_scope`, naming the scopes the
  connection holds with the module's read and write (`toModuleScopeChallenge`) and its resource
  metadata, as MCP's step-up asks, so the client can ask the member again, and the member's new
  consent replaces the connection, keeping what it held. The tool stays listed, so the model knows
  the write exists. Strategy Dance's agent holds every scope and is never challenged, nor is a
  server over stdio, whose calls carry no `authInfo`. The tool's own check of the scope stays behind
  it, refusing before anything is read or written
*/
function requireModuleWriteScope(module: ModuleDefinition): ScopeChallengeHandler {
  const read = module.scopes.read as Parameters<typeof toModuleScopeChallenge>[1][0]
  const write = module.scopes.write as typeof read

  return ({ authInfo }) => {
    if (!authInfo) return undefined

    const access = readModuleAccess(authInfo)

    if (access.scopes.includes(write)) return undefined
    if (access.kind === 'agent') return { scopes: [read, write] }

    return toModuleScopeChallenge(access, [read, write], `Writing here needs ${write}`)
  }
}

export default requireModuleWriteScope
