import type { ModuleCall, ModuleCaller } from '~types'

import { MODULE_CALL_RESULT_LIFETIME_MS } from '~constants'

/*
  The variables every write of a module takes for its idempotency key: whether the call carries one,
  and what the write keeps under it, the result the tool answers as JSON text. An external agent's
  expire a day after the call, and Strategy Dance's agent's last as long as their conversation. A
  call without a key skips the insert, and its key's variables say nothing
*/
function toModuleCallVariables(caller: ModuleCaller, call: ModuleCall | null, result: unknown) {
  if (!call) {
    return {
      isKeyed: false,
      idempotencyScope: '',
      idempotencyKey: '',
      tool: '',
      argumentsHash: '',
      result: '',
      expiresAt: null,
    }
  }

  return {
    isKeyed: true,
    idempotencyScope: caller.idempotencyScope,
    idempotencyKey: call.key,
    tool: call.tool,
    argumentsHash: call.argumentsHash,
    result: JSON.stringify(result),
    expiresAt: caller.kind === 'external' ? new Date(Date.now() + MODULE_CALL_RESULT_LIFETIME_MS).toISOString() : null,
  }
}

export default toModuleCallVariables
