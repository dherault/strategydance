import { requireScopes, type ScopeChallengeHandler } from '@modelcontextprotocol/server'
import type { ModuleDefinition } from 'strategydance-core'

/*
  What every write tool of a module registers as its `scopeChallenge`: a call from a connection
  granted read alone answers 403, `insufficient_scope`, naming the module's write scope and its
  resource metadata, as MCP's step-up asks, so the client can ask the member again for read and
  write, and the member's new consent replaces the connection. The tool stays listed, so the model
  knows the write exists. Strategy Dance's agent holds every scope and is never challenged. The
  tool's own check of the scope stays behind it, refusing before anything is read or written
*/
function requireModuleWriteScope(module: ModuleDefinition): ScopeChallengeHandler {
  return requireScopes(module.scopes.write)
}

export default requireModuleWriteScope
