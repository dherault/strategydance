import { useEffect, useEffectEvent } from 'react'

import useConversationSubagents from '~hooks/conversation/useConversationSubagents'
import useIsConversationSubagent from '~hooks/conversation/useIsConversationSubagent'

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
  once for the conversation it was made for. An id the conversation's subagents do not hold, a
  subagent a Retry discarded meanwhile say, closes it once the server says so too, since the list a
  page holds can be one read before the subagent was launched, until its subscription brings it anew
*/
function ConversationSubagentViewer({ conversationId, subagentId, onClose }: Props) {
  const subagents = useConversationSubagents(conversationId, { isEnabled: subagentId !== null })
  const canonicalId = subagentId?.replaceAll('-', '').toLowerCase() ?? null
  const subagent = canonicalId ? subagents.data.find(({ id }) => id === canonicalId) : undefined
  const isUnlisted = canonicalId !== null && !subagent && !subagents.initialLoading && !subagents.hasFailed
  // The list held can be older than the subagent, so only the server's word that it is not there closes
  const isListedOnServer = useIsConversationSubagent(conversationId, canonicalId, { isEnabled: isUnlisted })
  const isGone = isUnlisted && isListedOnServer === false

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
