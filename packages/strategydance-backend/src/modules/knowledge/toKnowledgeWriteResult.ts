import type { KnowledgeWriteResult } from '~types'

import toKnowledgeRefusal from '~modules/knowledge/toKnowledgeRefusal'
import toToolResult from '~modules/toToolResult'

/*
  What a write tool of the Knowledge module answers: its result, the same whether the write ran now
  or was answered from its idempotency key, a document's web address added for an external caller,
  or the refusal worded for the model
*/
async function toKnowledgeWriteResult<Result extends { id: string }>(
  written: KnowledgeWriteResult<Result>,
  toAddress: ((documentId: string) => Promise<string | undefined>) | null,
) {
  if (written.outcome !== 'written' && written.outcome !== 'answered') return toKnowledgeRefusal(written)

  const result = written.result as Result
  const url = toAddress ? await toAddress(result.id) : undefined

  return toToolResult({ ...result, ...(url && { url }) })
}

export default toKnowledgeWriteResult
