import express, { type Request, type Response, Router } from 'express'
import { type ApiResponse, ERROR_CODE_INTERNAL_ERROR, ERROR_CODE_SERVICE_UNAVAILABLE } from 'strategydance-core'
import { z } from 'zod'

import { UUID_PATTERN } from '~constants'

import respondError from '~utils/respondError'
import runSweepSteps from '~utils/runSweepSteps'
import toCanonicalUuid from '~utils/toCanonicalUuid'

import validateMiddleware from '~middleware/validate'

import createAnthropicClaudeClient from '~domain/agent/createAnthropicClaudeClient'
import pruneBillReceipts from '~domain/budget/pruneBillReceipts'
import pruneDeletedBills from '~domain/budget/pruneDeletedBills'
import syncExchangeRates from '~domain/budget/syncExchangeRates'
import pruneCappedStarts from '~domain/conversations/pruneCappedStarts'
import pruneConversationAttachments from '~domain/conversations/pruneConversationAttachments'
import pruneConversationSearches from '~domain/conversations/pruneConversationSearches'
import pruneDeletedConversations from '~domain/conversations/pruneDeletedConversations'
import pruneRunSpends from '~domain/conversations/pruneRunSpends'
import runConversation from '~domain/conversations/runConversation'
import sweepDeadConversationRuns from '~domain/conversations/sweepDeadConversationRuns'
import publishDirectoryCheck from '~domain/directories/publishDirectoryCheck'
import pruneDeletedDocuments from '~domain/documents/pruneDeletedDocuments'
import pruneDocumentRevisions from '~domain/documents/pruneDocumentRevisions'
import createGitHubAppToken from '~domain/github/createGitHubAppToken'
import createGitHubClient from '~domain/github/createGitHubClient'
import pruneDeletedIntegrations from '~domain/integrations/pruneDeletedIntegrations'
import pruneIntegrationAuthorizations from '~domain/integrations/pruneIntegrationAuthorizations'
import pruneModuleCallResults from '~domain/modules/pruneModuleCallResults'
import pruneAgentConnectionTokens from '~domain/oauth/pruneAgentConnectionTokens'
import pruneOAuthAuthorizationRequests from '~domain/oauth/pruneOAuthAuthorizationRequests'
import pruneOAuthClients from '~domain/oauth/pruneOAuthClients'
import pruneUnservedAgentConnections from '~domain/oauth/pruneUnservedAgentConnections'
import sweepSubagentReactions from '~domain/subagents/sweepSubagentReactions'
import sweepSubagentRuns from '~domain/subagents/sweepSubagentRuns'
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
    RECONCILE
  --- */

  /*
    Reconciles the runs no page reconciles, as Cloud Scheduler asks every five minutes: the subagent
    runs past their lease or waiting for a slot, for every member with one, as a parent's page would,
    the runs of members' conversations past their lease, a reaction to subagents' reports above all,
    and the reactions no run's end started. A run whose task never came, its process gone between
    storing it and queueing it, is queued again while it is young rather than finalized as
    interrupted once older, and a slot freed is promoted into within minutes rather than at the
    daily sweep. Each step goes on past what fails in it, and throws once done when anything did
    (`SweepIncomplete`), which the route answers with a 500 naming it, after the steps after it ran.
    Every one is idempotent, so two that overlap, this and the daily sweep say, do each thing once.
    Takes no body
  */
  router.post('/runs-reconcile', async (_request: Request, response: Response<ApiResponse>) => {
    const failed = await runSweepSteps({ sweepSubagentRuns, sweepDeadConversationRuns, sweepSubagentReactions })

    if (failed.length) {
      respondError(response, 500, ERROR_CODE_INTERNAL_ERROR, `The reconcile's steps failed: ${failed.join(', ')}`)

      return
    }

    response.json({ status: 'success' })
  })

  /* ---
    SWEEP
  --- */

  /*
    Syncs first the ECB's exchange rates from Frankfurter (`syncExchangeRates`), then reconciles the
    runs no page reconciled, as the reconcile every five minutes does, then removes what is still
    deleted past its Undo window, whether or not anybody comes back, as Cloud Scheduler asks once a
    day: the conversations, subagents before their parents, with their files, the board's tasks, the
    bills, the documents and the organizations' MCP servers, with their keys and members'
    connections, deleted over a day ago, the files uploaded to conversations and never sent, and the
    bills' receipts no bill holds three days after their upload, after the bills, so a bill pruned
    frees its receipt in the same sweep. A milestone that keeps
    something else deleted for a while adds its prune here. So does one that keeps a count or a
    record for a while, as the conversation searches, the starts the daily caps counted and what
    runs may have cost, over a day old, go, documents' revisions over 30 days old, the module call
    results past their expiry, members' Connects to MCP servers expired over an hour ago, and the
    authorization server's requests expired over a day ago, the connections to a module no endpoint
    serves any more idle for a week, its tokens past their expiry and the registrations nobody uses.

    Each step runs whatever the steps before it met (`runSweepSteps`), so a prune that fails, or one
    that takes long, never keeps the keys and tokens after it from going. Every step is idempotent,
    so a sweep that failed is finished by the next. Takes no body
  */
  router.post('/sweep', async (_request: Request, response: Response<ApiResponse>) => {
    const failed = await runSweepSteps({
      syncExchangeRates,
      sweepSubagentRuns,
      sweepDeadConversationRuns,
      sweepSubagentReactions,
      pruneDeletedConversations,
      pruneConversationAttachments,
      pruneConversationSearches,
      pruneCappedStarts,
      pruneRunSpends,
      pruneDeletedTasks,
      pruneDeletedBills,
      pruneBillReceipts,
      pruneDeletedDocuments,
      pruneDocumentRevisions,
      pruneDeletedIntegrations,
      pruneIntegrationAuthorizations,
      pruneModuleCallResults,
      pruneOAuthAuthorizationRequests,
      pruneUnservedAgentConnections,
      pruneAgentConnectionTokens,
      pruneOAuthClients,
    })

    if (failed.length) {
      respondError(response, 500, ERROR_CODE_INTERNAL_ERROR, `The sweep's steps failed: ${failed.join(', ')}`)

      return
    }

    response.json({ status: 'success' })
  })

  /*
    Checks a day's directories, as Cloud Scheduler asks once a day, and commits what it found to the
    rolling pull request into `dev`, opening one when none is open (`publishDirectoryCheck`): a run
    takes a few minutes, inside the worker's fifteen. A run that fails leaves the lists as they were,
    and the next day picks the same directories. Takes no body
  */
  router.post('/directories-check', async (_request: Request, response: Response<ApiResponse>) => {
    await publishDirectoryCheck({
      github: createGitHubClient(await createGitHubAppToken()),
      claude: createAnthropicClaudeClient(),
      today: new Date().toISOString().slice(0, 10),
    })

    response.json({ status: 'success' })
  })

  return router
}

export default createInternalRouter
