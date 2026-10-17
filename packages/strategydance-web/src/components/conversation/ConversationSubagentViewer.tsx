import { useEffect, useEffectEvent } from 'react'

import useConversationSubagents from '~hooks/conversation/useConversationSubagents'

import ConversationSubagentDialog from '~components/conversation/ConversationSubagentDialog'

type Props = {
  // The conversation whose subagent is viewed
  conversationId: string
  // The subagent whose work is open, hyphenated or not, or null while none is
  subagentId: string | null
  onClose: () => void
}

/*
  Where a conversation's page and its dock's window show a subagent's work, whichever of its rows
  opened it, or the address did: the subagent is found among the conversation's, so its head says
  where it stands live, and its viewer is drawn anew for each one opened, since a thread is read
  once for the conversation it was made for. An id the conversation's subagents do not hold, once
  they are read, a subagent a Retry discarded meanwhile say, closes it
*/
function ConversationSubagentViewer({ conversationId, subagentId, onClose }: Props) {
  const subagents = useConversationSubagents(conversationId, { isEnabled: subagentId !== null })
  const canonicalId = subagentId?.replaceAll('-', '').toLowerCase() ?? null
  const subagent = canonicalId ? subagents.data.find(({ id }) => id === canonicalId) : undefined
  const isGone = canonicalId !== null && !subagent && !subagents.initialLoading && !subagents.hasFailed

  const close = useEffectEvent(onClose)

  useEffect(() => {
    if (isGone) close()
  }, [isGone])

  if (!subagent) return null

  return (
    <ConversationSubagentDialog
      key={subagent.id}
      conversationId={conversationId}
      subagent={subagent}
      onClose={onClose}
    />
  )
}

export default ConversationSubagentViewer
