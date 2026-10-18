import { MAX_CONVERSATION_SUBAGENTS, MAX_SUBAGENTS_PER_ACTION } from 'strategydance-core'

import type { SubagentsRefusal } from '~types'

import toToolRefusal from '~modules/toToolRefusal'

/*
  A refusal of the Subagents module, as the model reads it: what happened, in a sentence it can act
  on, by doing the work itself, ending its turn, or changing what it sent
*/
function toSubagentsRefusal(refusal: SubagentsRefusal) {
  return toToolRefusal(toSentence(refusal))
}

function toSentence(refusal: SubagentsRefusal) {
  switch (refusal.outcome) {
    case 'noLauncher':
      return "Subagents are launched, read and stopped only from a run of one of the member's conversations, which this call does not come from."
    case 'notMember':
      return 'The member is no longer in this organization, so its subagents are closed to you.'
    case 'readOnly':
      return 'This connection may only read subagents.'
    case 'fromSubagent':
      return 'A subagent launches, reads and stops no subagents. Do the work yourself, and say in your report what you would have handed off.'
    case 'fromReaction':
      return "This run reacts to subagents' reports, and launches no subagents: every one starts from the member's word. Do the work yourself, or tell the member what you would hand off."
    case 'launcherEnded':
      return 'This run has ended or was asked to stop, so it launches and stops no subagents. Launch nothing more, and end your turn.'
    case 'notFound':
      return 'This conversation launched no subagent with that id. List its subagents to find it: one a retry discarded is not listed.'
    case 'invalid':
      return `${refusal.reason}.`
    case 'tooManyOnAnchor':
      return `A run launches at most ${MAX_SUBAGENTS_PER_ACTION} subagents for one message of the member's. Do the rest of the work yourself.`
    case 'tooMany':
      return `This conversation holds ${MAX_CONVERSATION_SUBAGENTS} subagents, the most it keeps. Do the work yourself, or tell the member, who can start a new conversation.`
    case 'attachmentsInvalid':
      return "A subagent is handed only files this conversation has sent, by the ids the member's messages name them with. Leave the others out, and put what the subagent needs of them in its brief."
    case 'overBudget':
      return `${refusal.reason}. Hand it fewer files, and put what it needs of the rest in its brief.`
    case 'unavailable':
      return 'The subagent was launched, but could not be queued yet. Call launch_subagent again in a moment, with the same idempotency key.'
    case 'busy':
      return 'The subagent kept changing while you stopped it. Read it, then try once more.'
    case 'keyConflict':
      return 'That idempotency key was sent before with another call. Send a new key with each new call.'
    case 'invalidCursor':
      return 'That cursor was not given by this tool. Leave it out to read from the start.'
  }
}

export default toSubagentsRefusal
