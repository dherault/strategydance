import type { ConversationRunReference } from '~types'

import finalizeDeadConversationRun from '~domain/conversations/finalizeDeadConversationRun'

/*
  What the conversation's page asks for when it sees the run it shows past its lease: the run ends
  interrupted, with its note, when it died with its worker, so the page stops showing it as going,
  and is left as it is otherwise, a worker that renewed its lease meanwhile keeping it. Answers
  `missing` for a run that is not in the caller's conversation
*/
async function reconcileConversationRun(reference: ConversationRunReference) {
  const state = await finalizeDeadConversationRun(reference)

  return state === 'missing' ? { outcome: 'missing' as const } : { outcome: 'reconciled' as const }
}

export default reconcileConversationRun
