import type { ConversationRun } from '~types'

import type { StartedConversationRun } from '~utils/conversation/isAwaitingConversationRun'

import type { ConversationPendingMessage } from '~data/conversationComposerDrafts'

type Options = {
  // The conversation's latest run, and whether it goes
  run: Pick<ConversationRun, 'createdAt'> | null
  isWorking: boolean
  // The message whose send is going, if any
  sendingMessage: Pick<ConversationPendingMessage, 'sentAt'> | null
  // The run the reader last started, and whether the read has still to show it
  startedRun: Pick<StartedConversationRun, 'startedAt'> | null
  isAwaiting: boolean
}

/*
  When the thinking indicator counts from: the run, once the page has read it going, and before
  that, when the reader sent the message that starts it, while its send goes and until the run is
  read. Kept with the draft rather than by the indicator, so the count carries on as a draft's thread
  gives way to the conversation's. Null for a run started otherwise, which counts from when the
  indicator appeared
*/
function getConversationThinkingStart({ run, isWorking, sendingMessage, startedRun, isAwaiting }: Options) {
  if (isWorking) return run?.createdAt ?? null
  if (sendingMessage) return sendingMessage.sentAt
  if (isAwaiting) return startedRun?.startedAt ?? null

  return null
}

export default getConversationThinkingStart
