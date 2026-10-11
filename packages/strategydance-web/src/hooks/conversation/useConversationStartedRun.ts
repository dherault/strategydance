import useConversationComposerDraft from '~hooks/conversation/useConversationComposerDraft'

import type { StartedConversationRun } from '~utils/conversation/isAwaitingConversationRun'

/*
  The run the reader last started in a conversation, by a send, a resume, a retry or an answer, and
  what records it. Kept beside the message being written rather than by whatever draws the
  conversation, so its page and its dock's window, and a composer drawn again while a send goes,
  all count the run as going before the live read of the latest run shows it
*/
function useConversationStartedRun(conversationId: string) {
  const [{ startedRun }, changeDraft] = useConversationComposerDraft(conversationId)

  function setStartedRun(next: StartedConversationRun | null) {
    changeDraft(() => ({ startedRun: next }))
  }

  return [startedRun, setStartedRun] as const
}

export default useConversationStartedRun
