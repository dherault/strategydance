import { getModuleCallResult } from 'strategydance-database/backend'

import type { ModuleCall, ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

type ReadModuleCallResultResult =
  | { outcome: 'none' }
  /** The call was made before under its key, and answered this */
  | { outcome: 'answered'; result: unknown }
  /** The key was sent before with another call: another tool, other arguments, or somebody else's */
  | { outcome: 'keyConflict' }

/*
  What a module's write stored under the caller's idempotency key, read before the write runs and
  again when it finds the key taken. Only the same tool called with the same arguments, by the same
  member in the same organization, is answered with it: `delete_document` and `restore_document`
  both take `{ id }`, so a key sent to one then to the other is refused rather than answered
*/
async function readModuleCallResult(caller: ModuleCaller, call: ModuleCall): Promise<ReadModuleCallResultResult> {
  const { data } = await getModuleCallResult(dataConnect, {
    idempotencyScope: caller.idempotencyScope,
    idempotencyKey: call.key,
  })
  const stored = data.moduleCallResult

  if (!stored) return { outcome: 'none' }

  const isSameCall =
    stored.tool === call.tool
    && stored.argumentsHash === call.argumentsHash
    && stored.userId === caller.userId
    && toCanonicalUuid(stored.organizationId) === toCanonicalUuid(caller.organizationId)

  if (!isSameCall) return { outcome: 'keyConflict' }

  return { outcome: 'answered', result: JSON.parse(stored.result) }
}

export default readModuleCallResult
