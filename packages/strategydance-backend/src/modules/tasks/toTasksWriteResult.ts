import type { TasksWriteResult } from '~types'

import toTasksRefusal from '~modules/tasks/toTasksRefusal'
import toToolResult from '~modules/toToolResult'

/*
  What a write tool of the Tasks module answers: its result, the same whether the write ran now or
  was answered from its idempotency key, a task's web address added for an external caller, or the
  refusal worded for the model
*/
async function toTasksWriteResult<Result extends { id: string }>(
  written: TasksWriteResult<Result>,
  toAddress: ((taskId: string) => Promise<string | undefined>) | null,
) {
  if (written.outcome !== 'written' && written.outcome !== 'answered') return toTasksRefusal(written)

  const result = written.result as Result
  const url = toAddress ? await toAddress(result.id) : undefined

  return toToolResult({ ...result, ...(url && { url }) })
}

export default toTasksWriteResult
