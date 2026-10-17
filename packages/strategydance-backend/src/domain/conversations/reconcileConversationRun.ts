import type { ConversationRunReference } from '~types'

import continueConversationRun from '~domain/conversations/continueConversationRun'
import finalizeDeadConversationRun from '~domain/conversations/finalizeDeadConversationRun'
import startDueSubagentReactions from '~domain/subagents/startDueSubagentReactions'

/*
  What the conversation's page asks for when it sees the run it shows past its lease: the run ends
  interrupted, with its note, when it died with its worker, so the page stops showing it as going,
  and is left as it is otherwise, a worker that renewed its lease meanwhile keeping it.

  The page asks too when it sees the run waiting on questions all answered: the conversation is
  carried on, as the last answer would have, had its backend not stopped first or its member had
  fewer runs going. Answers `missing` for a run that is not in the caller's conversation, and for a
  subagent's, which no member action reaches.

  A run that ended freed one of the member's 3, which a reaction to subagents' reports held back by
  them takes, this conversation's first
*/
async function reconcileConversationRun(reference: ConversationRunReference) {
  const state = await finalizeDeadConversationRun(reference, 'conversation-runs')

  if (state === 'missing') return { outcome: 'missing' as const }

  // A run that ended may be one waiting on answers, which this carries on, and leaves any other be
  if (state === 'ended') {
    await continueConversationRun(reference)
    await startDueSubagentReactions(reference, { first: reference.conversationId })
  }

  return { outcome: 'reconciled' as const }
}

export default reconcileConversationRun
