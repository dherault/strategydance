import type { ConversationRunReference } from '~types'

import continueConversationRun from '~domain/conversations/continueConversationRun'
import finalizeDeadConversationRun from '~domain/conversations/finalizeDeadConversationRun'

/*
  What the conversation's page asks for when it sees the run it shows past its lease: the run ends
  interrupted, with its note, when it died with its worker, so the page stops showing it as going,
  and is left as it is otherwise, a worker that renewed its lease meanwhile keeping it.

  The page asks too when it sees the run waiting on questions all answered: the conversation is
  carried on, as the last answer would have, had its backend not stopped first or its member had
  fewer runs going. Answers `missing` for a run that is not in the caller's conversation
*/
async function reconcileConversationRun(reference: ConversationRunReference) {
  const state = await finalizeDeadConversationRun(reference)

  if (state === 'missing') return { outcome: 'missing' as const }

  // A run that ended may be one waiting on answers, which this carries on, and leaves any other be
  if (state === 'ended') await continueConversationRun(reference)

  return { outcome: 'reconciled' as const }
}

export default reconcileConversationRun
