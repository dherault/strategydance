import { useEffect, useRef } from 'react'

import type { ConversationRun } from '~types'

import { CONVERSATION_RUN_RECONCILE_INTERVAL_MS } from '~constants'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import getConversationRunReconcileDelay from '~utils/conversation/getConversationRunReconcileDelay'

import { requestApi } from '~data/api'

/*
  Asks the backend to reconcile a conversation's latest run once its lease has passed, and every
  two minutes after while the run stays as it is. A run that died with its worker, queued and never
  taken up or taken up by a backend that stopped, then ends interrupted, with its note, which the
  page's live queries bring in place of the thinking indicator. One whose worker renewed its lease
  meanwhile moves the lease, which arms this again, a whole lease from when the page saw it move, so
  a reader's clock ahead of the database's never reads a renewed lease as passed. A run waiting on
  questions the thread shows all answered is asked for a few seconds in, and every two minutes
  after, so the conversation is carried on when its last answer could not.

  Not awaited, and failing on its own, as the next ask tries again: nothing on the page waits on it
*/
function useReconcileConversationRun(
  conversationId: string,
  run: ConversationRun | null,
  // Whether the thread shows no question waiting, which a run waiting on them is carried on after
  isEveryQuestionAnswered: boolean,
) {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null
  const runId = run?.id ?? null
  const status = run?.status ?? null
  const leaseExpiresAt = run?.leaseExpiresAt ?? null
  // The run's lease as the page last saw it, and when, on the reader's clock, it last saw it move
  const seenLease = useRef<{ runId: string; leaseExpiresAt: string | null; movedAt: number | null } | null>(null)

  useEffect(() => {
    if (!organizationId || !runId || !status) return

    const seen = seenLease.current?.runId === runId ? seenLease.current : null
    const movedAt = seen && seen.leaseExpiresAt !== leaseExpiresAt ? Date.now() : (seen?.movedAt ?? null)

    seenLease.current = { runId, leaseExpiresAt, movedAt }

    const delay = getConversationRunReconcileDelay({ status, leaseExpiresAt }, Date.now(), {
      isEveryQuestionAnswered,
      leaseMovedAt: movedAt,
    })

    if (delay === null) return

    let interval: ReturnType<typeof setInterval> | undefined

    // A hidden tab asks nothing: the worker reconciles every few minutes what no page watches, and
    // the tab asks again at its next tick once it is in view
    function reconcile() {
      if (document.visibilityState === 'hidden') return

      requestApi({
        method: 'POST',
        path: `/organizations/${organizationId}/conversations/${conversationId}/runs/${runId}/reconcile`,
      }).catch(error => {
        console.error('The conversation’s run could not be reconciled', error)
      })
    }

    const timeout = setTimeout(() => {
      reconcile()
      interval = setInterval(reconcile, CONVERSATION_RUN_RECONCILE_INTERVAL_MS)
    }, delay)

    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [organizationId, conversationId, runId, status, leaseExpiresAt, isEveryQuestionAnswered])
}

export default useReconcileConversationRun
