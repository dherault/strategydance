import type { ModuleCall, ModuleCaller } from '~types'

import readModuleCallResult from '~domain/modules/readModuleCallResult'

/*
  What a write answers when its call was made before under its idempotency key: the result stored
  then, or a refusal when the key was sent with another call. Null for a call without a key, or one
  whose key nothing holds yet, which then runs. A write asks first, and again when it finds the key
  taken, by a call that wrote meanwhile
*/
async function answerFromModuleCall(caller: ModuleCaller, call: ModuleCall | null) {
  if (!call) return null

  const stored = await readModuleCallResult(caller, call)

  return stored.outcome === 'none' ? null : stored
}

export default answerFromModuleCall
