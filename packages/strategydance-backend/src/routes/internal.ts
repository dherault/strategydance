import express, { type Request, type Response, Router } from 'express'
import { type ApiResponse, ERROR_CODE_SERVICE_UNAVAILABLE } from 'strategydance-core'
import { z } from 'zod'

import { UUID_PATTERN } from '~constants'

import respondError from '~utils/respondError'
import toCanonicalUuid from '~utils/toCanonicalUuid'

import validateMiddleware from '~middleware/validate'

import pruneConversationSearches from '~domain/conversations/pruneConversationSearches'
import pruneDeletedConversations from '~domain/conversations/pruneDeletedConversations'
import runConversation from '~domain/conversations/runConversation'
import pruneDeletedTasks from '~domain/tasks/pruneDeletedTasks'

/*
  What Google Cloud calls on the worker, mounted at `/internal` by the worker alone, never by the
  backend.

  No route here checks App Check or a token. The worker is private: Cloud Run's invoker check is on,
  and the `conversation-tasks` service account is the one account granted the invoker role on it.
  Holders of Cloud Run's invoke permission across the project, its owners and `deployer`, can call
  it too, as they can any service there, and Cloud Run refuses everybody else, a caller with no
  token included, before this code runs. Cloud Tasks and Cloud Scheduler call it as
  `conversation-tasks`, with an OIDC token Cloud Run checks
*/
function createInternalRouter() {
  const router = Router()

  /* ---
    CONVERSATION RUNS
  --- */

  // The run a task names, as `queueConversationRun` writes it
  const conversationRunBodySchema = z.object({
    organizationId: z.string().regex(UUID_PATTERN),
    userId: z.string().min(1).max(128),
    conversationId: z.string().regex(UUID_PATTERN),
    runId: z.string().regex(UUID_PATTERN),
  })

  type ConversationRunRequest = Request<Record<string, never>, ApiResponse, z.infer<typeof conversationRunBodySchema>>

  /*
    Runs a conversation's run, which a Cloud Tasks task delivers, for as long as the run goes: the
    request stays open the whole time, so Cloud Run keeps its CPU. Answers 200 once the run has
    ended, now or before, and 503 while it is not finished, another worker holding its lease or
    this one having left it to its lease, so Cloud Tasks delivers it again later. The queue's
    backoff, 90 seconds, outlasts a lease
  */
  router.post(
    '/conversation-runs',
    express.json(),
    validateMiddleware({ body: conversationRunBodySchema }),
    async (request: ConversationRunRequest, response: Response<ApiResponse>) => {
      const outcome = await runConversation({
        organizationId: toCanonicalUuid(request.body.organizationId),
        userId: request.body.userId,
        conversationId: toCanonicalUuid(request.body.conversationId),
        runId: toCanonicalUuid(request.body.runId),
      })

      if (outcome === 'held') {
        respondError(response, 503, ERROR_CODE_SERVICE_UNAVAILABLE, 'The run is not finished, and is delivered later')

        return
      }

      response.json({ status: 'success' })
    },
  )

  /* ---
    SWEEP
  --- */

  /*
    Removes what is still deleted past its Undo window, whether or not anybody comes back, as Cloud
    Scheduler asks once a day: today the conversations and the board's tasks deleted over a day ago.
    A milestone that keeps something else deleted for a while adds its prune here. So does one that
    keeps a count for a while, as the conversation searches over a day old go. Every step is
    idempotent, so a sweep that failed is finished by the next. Takes no body
  */
  router.post('/sweep', async (_request: Request, response: Response<ApiResponse>) => {
    await pruneDeletedConversations()
    await pruneConversationSearches()
    await pruneDeletedTasks()

    response.json({ status: 'success' })
  })

  return router
}

export default createInternalRouter
