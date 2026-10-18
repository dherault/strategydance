import { useEffect } from 'react'

import type { Conversation, ConversationRun, ConversationSubagent } from '~types'

import { CONVERSATION_SUBAGENTS_RECONCILE_INTERVAL_MS } from '~constants'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import getConversationSubagentsReconcileDelay from '~utils/conversation/getConversationSubagentsReconcileDelay'

import { requestApi } from '~data/api'

/*
  Asks the backend to reconcile a conversation's subagents while any is busy, every two minutes, or a
  few seconds in once a batch of them has reported whole while the conversation could react, and
  every two minutes after. No page polls a subagent's own run, so this is what ends one whose worker
  died, queues again one whose task was lost, gives a slot to one waiting, and starts the reaction a
  conversation held back, restored or with the reader's runs going elsewhere, did not start. It
  reconciles every subagent of the reader's in the organization, since any holds one of their
  slots.

  The timer is keyed on how long it waits alone, so the list's pushes, which every run of the
  reader's in the organization brings, never put it back. Not awaited, and failing on its own, as
  the next ask tries again: nothing on the page waits on it
*/
function useReconcileConversationSubagents(
  conversation: Conversation,
  run: ConversationRun | null,
  subagents: readonly ConversationSubagent[],
  { isEnabled }: { isEnabled: boolean },
) {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null
  const conversationId = conversation.id
  const delay = isEnabled ? getConversationSubagentsReconcileDelay(subagents, conversation, run) : null

  useEffect(() => {
    if (!organizationId || delay === null) return

    let interval: ReturnType<typeof setInterval> | undefined

    // A hidden tab asks nothing: the worker reconciles every few minutes what no page watches, and
    // the tab asks again at its next tick once it is in view
    function reconcile() {
      if (document.visibilityState === 'hidden') return

      requestApi({
        method: 'POST',
        path: `/organizations/${organizationId}/conversations/${conversationId}/subagents/reconcile`,
      }).catch(error => {
        console.error('The conversation’s subagents could not be reconciled', error)
      })
    }

    const timeout = setTimeout(() => {
      reconcile()
      interval = setInterval(reconcile, CONVERSATION_SUBAGENTS_RECONCILE_INTERVAL_MS)
    }, delay)

    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [organizationId, conversationId, delay])
}

export default useReconcileConversationSubagents
