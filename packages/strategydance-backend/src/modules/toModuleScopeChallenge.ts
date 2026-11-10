import type { ScopeChallenge } from '@modelcontextprotocol/server'
import { type ModuleScope, toModuleScopesInOrder } from 'strategydance-core'

import type { ModuleAccess } from '~types'

/*
  The scopes a challenge names for a call its access cannot make, as MCP's step-up asks: those the
  connection holds with those the call needs, in `MODULES`' order, rather than the needed ones
  alone, so a client that asks again for exactly them keeps every module it held, and names each
  write with its read, as a consent asks. The connection's rather than the token's, since a refresh
  may have narrowed the token below it, and the challenge is all the client reads
*/
function toModuleScopeChallenge(
  access: Extract<ModuleAccess, { kind: 'external' }>,
  needed: readonly [ModuleScope, ...ModuleScope[]],
  errorDescription: string,
): ScopeChallenge {
  const [first = needed[0], ...rest] = toModuleScopesInOrder([...access.connectionScopes, ...needed])

  return { scopes: [first, ...rest], errorDescription }
}

export default toModuleScopeChallenge
