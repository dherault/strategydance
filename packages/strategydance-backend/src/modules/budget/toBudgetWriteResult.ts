import type { BudgetWriteResult } from '~types'

import toBudgetRefusal from '~modules/budget/toBudgetRefusal'
import toToolResult from '~modules/toToolResult'

/*
  What a write answers: its result, or the one stored under its key when the call was sent before,
  with the bill's web address for an external caller, read afresh rather than stored, or a refusal
  as a sentence
*/
async function toBudgetWriteResult<Result extends { id: string }>(
  written: BudgetWriteResult<Result>,
  toAddress: ((billId: string) => Promise<string | undefined>) | null,
) {
  if (written.outcome !== 'written' && written.outcome !== 'answered') return toBudgetRefusal(written)

  const result = written.result as Result
  const url = toAddress ? await toAddress(result.id) : undefined

  return toToolResult({ ...result, ...(url && { url }) })
}

export default toBudgetWriteResult
