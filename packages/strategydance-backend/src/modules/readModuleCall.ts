import type { ServerContext } from '@modelcontextprotocol/server'

import type { ModuleCall } from '~types'

import { MAX_MODULE_IDEMPOTENCY_KEY_LENGTH, MODULE_IDEMPOTENCY_KEY_META } from '~constants'

import hashModuleCallArguments from '~domain/modules/hashModuleCallArguments'

type ReadModuleCallResult = { outcome: 'read'; call: ModuleCall | null } | { outcome: 'invalidKey' }

/*
  The idempotency key a write's call carries in its `_meta`, with the tool and a hash of its
  arguments, which a call sent again under the key has to match. No key is no call to keep, and a
  key that is no string of 1 to 200 characters is refused, as is one holding U+0000, which Postgres
  refuses in any text
*/
function readModuleCall(context: ServerContext, tool: string, args: unknown): ReadModuleCallResult {
  const key = context.mcpReq._meta?.[MODULE_IDEMPOTENCY_KEY_META]

  if (key === undefined) return { outcome: 'read', call: null }

  if (
    typeof key !== 'string'
    || key.length < 1
    || key.length > MAX_MODULE_IDEMPOTENCY_KEY_LENGTH
    || key.includes('\u0000')
  ) {
    return { outcome: 'invalidKey' }
  }

  return { outcome: 'read', call: { key, tool, argumentsHash: hashModuleCallArguments(args) } }
}

export default readModuleCall
