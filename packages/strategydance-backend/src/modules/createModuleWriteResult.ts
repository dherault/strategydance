import type { CallToolResult } from '@modelcontextprotocol/server'

import toToolResult from '~modules/toToolResult'

// What a write of a module answers, as each module's `<Module>WriteResult` writes it with its refusals
type ModuleWriteResult<Result, Refusal> =
  | { outcome: 'written' | 'unchanged'; result: Result }
  | { outcome: 'answered'; result: unknown }
  | Refusal

/*
  A module's `to<Module>WriteResult`, what its write tools answer: the write's result, the same
  whether it ran now, was answered from its idempotency key or changed nothing, with the web address
  of what it wrote for an external caller where the module has one, read afresh rather than stored,
  or the refusal worded for the model through the module's own refusal. A module whose results carry
  no address says so with null, so one that has them cannot leave theirs out unawares
*/
function createModuleWriteResult<Refusal extends { outcome: string }>(toRefusal: (refusal: Refusal) => CallToolResult) {
  return async <Result extends { id: string }>(
    written: ModuleWriteResult<Result, Refusal>,
    toAddress: ((id: string) => Promise<string | undefined>) | null,
  ) => {
    // Only an answer carries a result, which no refusal does
    if (!('result' in written)) return toRefusal(written)

    const result = written.result as Result
    const url = toAddress ? await toAddress(result.id) : undefined

    return toToolResult({ ...result, ...(url && { url }) })
  }
}

export default createModuleWriteResult
