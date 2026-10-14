import type { ConversationRun } from '~types'

import type { StartedConversationRun } from '~utils/conversation/isAwaitingConversationRun'

import type { ConversationPendingMessage } from '~data/conversationComposerDrafts'

type Options = {
  // The conversation's latest run, and whether it goes
  run: Pick<ConversationRun, 'id' | 'createdAt'> | null
  isWorking: boolean
  // The message whose send is going, if any
  sendingMessage: Pick<ConversationPendingMessage, 'sentAt'> | null
  // The run the reader last started, and whether the read has still to show it
  startedRun: Pick<StartedConversationRun, 'runId' | 'startedAt'> | null
  isAwaiting: boolean
}

/*
  When the thinking indicator counts from: when the reader sent the message that starts the run,
  while its send goes, until the run is read and while it goes, so the count runs on from the moment
  they sent it, by one clock, the browser's. Kept with the draft rather than by the indicator, so the
  count carries on as a draft's thread gives way to the conversation's. Any other run counts from
  when it was queued, and one started otherwise, before it is read, from when the indicator appeared,
  which null says
*/
function getConversationThinkingStart({ run, isWorking, sendingMessage, startedRun, isAwaiting }: Options) {
  if (sendingMessage) return sendingMessage.sentAt
  if (startedRun?.startedAt && (isAwaiting || (isWorking && run?.id === startedRun.runId))) {
    return startedRun.startedAt
  }
  if (isWorking) return run?.createdAt ?? null

  return null
}

export default getConversationThinkingStart
