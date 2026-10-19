import { randomUUID } from 'node:crypto'
import { setTimeout as wait } from 'node:timers/promises'

import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import {
  MAX_CONVERSATION_MESSAGES,
  MAX_CONVERSATION_RUN_ENTRIES,
  MAX_SUBAGENT_RUNS,
  MAX_TOOL_CALLS_PER_RUN,
  buildConversationPreview,
} from 'strategydance-core'
import {
  ConversationMessageKind,
  ConversationNoteKind,
  ConversationRunStatus,
  ConversationRunTrigger,
  ConversationToolStatus,
  ConversationTranscriptRole,
  type GetConversationRunContextData,
  claimQueuedConversationRun,
  getConversationCalls,
  getConversationRunContext,
  getConversationRunLedgers,
  reclaimConversationRun,
  renewConversationRunLease,
  storeConversationToolResults,
  tagConversationAspects,
  getSubagentReactionContext,
} from 'strategydance-database/backend'

import type {
  ClaudeClient,
  ConversationContentBlock,
  ConversationModules,
  ConversationRunFence,
  ConversationRunReference,
  ConversationToolRunner,
} from '~types'

import {
  CONVERSATION_API_RETRY_DELAY_MS,
  CONVERSATION_RUN_MAX_COST_MICRODOLLARS,
  CONVERSATION_RUN_MAX_DURATION_MS,
  CONVERSATION_RUN_MAX_REQUESTS,
  CONVERSATION_RUN_STOP_CHECK_INTERVAL_MS,
  CONVERSATION_RUN_STREAM_DEADLINE_MS,
  CONVERSATION_TOOL_CALL_TIMEOUT_MS,
} from '~constants'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'
import toCanonicalUuid from '~utils/toCanonicalUuid'

import type { ConversationRequestConfig } from '~domain/agent/buildConversationRequest'
import buildConversationTools from '~domain/agent/buildConversationTools'
import buildSubagentTools, { isSubagentTool } from '~domain/agent/buildSubagentTools'
import carriesSubagentReportRequest from '~domain/agent/carriesSubagentReportRequest'
import checkTranscript from '~domain/agent/checkTranscript'
import connectConversationModules from '~domain/agent/connectConversationModules'
import conversationClaudeClient from '~domain/agent/conversationClaudeClient'
import { CONVERSATION_REQUEST_SETTINGS } from '~domain/agent/conversationRequestSettings'
import createConversationIntegrationRunners from '~domain/agent/createConversationIntegrationRunners'
import planConversationToolCalls, { type ConversationToolCallPlan } from '~domain/agent/planConversationToolCalls'
import readConversationToolCalls from '~domain/agent/readConversationToolCalls'
import SUBAGENT_REPORT_REQUEST from '~domain/agent/subagentReportRequest'
import readSubagentRequestSettings from '~domain/agent/subagentRequestSettings'
import SUBAGENT_SYSTEM_PROMPT from '~domain/agent/subagentSystemPrompt'
import CONVERSATION_SYSTEM_PROMPT from '~domain/agent/systemPrompt'
import buildConversationToolResults from '~domain/conversations/buildConversationToolResults'
import {
  type ConversationRunUsage,
  chargeUnsettledRequests,
  parseConversationRunUsage,
} from '~domain/conversations/conversationRunUsage'
import {
  UNRUN_AT_TIME_LIMIT_CALL_RESULT,
  serializePendingToolResults,
} from '~domain/conversations/conversationToolResults'
import createConversationRunLease, { type ConversationRunLease } from '~domain/conversations/createConversationRunLease'
import deriveConversationMessageId from '~domain/conversations/deriveConversationMessageId'
import drawConversationTurn from '~domain/conversations/drawConversationTurn'
import endConversationRun, {
  type ConversationRunEnding,
  type SubagentChain,
} from '~domain/conversations/endConversationRun'
import enqueueRun from '~domain/conversations/enqueueRun'
import isSubagentReportDue from '~domain/conversations/isSubagentReportDue'
import parseTranscriptContent from '~domain/conversations/parseTranscriptContent'
import readConversationTranscript from '~domain/conversations/readConversationTranscript'
import readSubagentReportDeadline from '~domain/conversations/readSubagentReportDeadline'
import readSubagentRunLimits from '~domain/conversations/readSubagentRunLimits'
import requestConversationTagging from '~domain/conversations/requestConversationTagging'
import requestConversationTurn, {
  type ConversationRunLimits,
  type ConversationTurnOutcome,
} from '~domain/conversations/requestConversationTurn'
import runConversationToolCalls from '~domain/conversations/runConversationToolCalls'
import serializeTranscriptContent from '~domain/conversations/serializeTranscriptContent'
import storeConversationParts from '~domain/conversations/storeConversationParts'
import deriveChainedRunId from '~domain/subagents/deriveChainedRunId'
import { isWaitingReport } from '~domain/subagents/findDueSubagentReports'
import readSubagentReportBlocks from '~domain/subagents/readSubagentReportBlocks'

// How many steps a run takes at most, each a request, a message drawn or its end. A run draws at
// most 100 entries before it sends no further request, so only a loop that would never end reaches it
const MAX_RUN_STEPS = 4 * MAX_CONVERSATION_RUN_ENTRIES

// How many steps in a row may fail before the worker leaves the run to its lease
const MAX_FAILED_STEPS = 5

type Options = {
  client?: ClaudeClient
  // How long the worker waits after a failed step, times the failures in a row
  retryDelayMs?: number
  // The run's limits, which a test can bring in
  limits?: Partial<ConversationRunLimits>
  // How often a streaming request reads whether the run's member asked to stop it
  stopCheckIntervalMs?: number
  // How long the worker waits before sending again a request Claude's API refused for a while, when
  // the answer does not say, doubled at each refusal in a row
  apiRetryDelayMs?: number
  // The modules the run's agent uses, connected for its member once the run is claimed, whose tools
  // its requests send and whose runners run its calls, which a test can bring in, and how long a
  // call may take
  connectModules?: (fence: ConversationRunFence) => Promise<ConversationModules>
  toolTimeoutMs?: number
  // What runs its calls to the organization's integrations, for its member, which a test can bring in
  createIntegrationRunners?: (fence: ConversationRunFence) => ConversationToolRunner[]
}

const LIMITS: ConversationRunLimits = {
  maxRequests: CONVERSATION_RUN_MAX_REQUESTS,
  maxDurationMs: CONVERSATION_RUN_MAX_DURATION_MS,
  streamDeadlineMs: CONVERSATION_RUN_STREAM_DEADLINE_MS,
  maxCostMicrodollars: CONVERSATION_RUN_MAX_COST_MICRODOLLARS,
}

type ConversationRunContext = GetConversationRunContextData

/*
  Runs a conversation's run, answers `finished` once it has ended, now or before, and `held` while
  it is not finished and a later delivery should come back to it: another worker holds its lease,
  or this one gave up on it, whose lease then lapses.

  It first claims the run, if it is queued or its worker stopped renewing its lease, and only for
  its author as the member it was queued under, their conversations suspended neither for their
  account nor in the organization: anybody else's run ends interrupted, with its note, so nothing is left for a later delivery. It connects
  to the modules its agent uses, as that member, whose tools its requests send after the agent's
  own. Then it takes one step at a time, each read afresh, so a worker taking over after a crash
  carries on where the last one stopped:

  - the run's reply not wholly drawn yet: the next message of it. The reply is the turn after the
    member's entry the run answers, its anchor, which a resumed run shares with the run it resumes,
    so it draws and carries on what that run left
  - a reply `pause_turn` paused, which a crash left stored part by part: its continuation
  - a reply wholly drawn that called Strategy Dance's own tools: the calls that have no result run,
    then the entry answering them all is stored and the run goes round to Claude. A reply that asked
    the member a question ends the run waiting for the answer instead
  - a reply wholly drawn that called nothing: the run is complete
  - before either ends the run, a reply wholly drawn to the conversation's first message, by its
    first run or one carrying it on, while nobody has set its aspects: the request that tags them
  - the member's message, or the results of the reply's calls: Claude's turn, stored part by part as
    it answered, unless the run has drawn its 100 entries, or the conversation holds its 2000, when
    the run fails with a note instead and costs nothing

  A run whose member asked it to stop sends no further request: it ends stopped, with its note, once
  what was paid for is written and drawn. One whose conversation was deleted stops without a note.

  A subagent's run sends the subagent's own system prompt and tools, which leave out `ask_user`, draws
  a call to an integration that would wait for an approval failed, since nobody can give one, never
  tags its conversation, draws no reply as unread, and ends through the
  subagent's own endings, which write its report, however it ends. At one of its limits before its
  fourth run it chains instead, to a run that carries it on, which is queued once this one has let
  go of its lease, the run answering `held` while it cannot be, so the delivery comes back to queue
  it, as a delivery finding the run chained does. Its calls count 50 for each run of the chain. Its
  fourth run asks for its report in the entry with a turn's results once one of its budgets nears its
  end (`isSubagentReportDue`), and that request, its last, goes past its limits while its time and its
  cost allow it, and nothing the reply to it calls runs.

  What a request came to, the turn to store or the run's end, is kept until it is written, so a
  write refused once is tried again, never paid for again. Every write is fenced on the run's
  attempt and its author's membership, and the step after a refused one reads which it was: a run
  claimed again or ended by somebody else is left alone, a removed author's is interrupted, a
  deleted conversation's stops, and anything else, a counter an aspects note moved say, is tried
  again
*/
async function runConversation(
  reference: ConversationRunReference,
  {
    client = conversationClaudeClient,
    retryDelayMs = 500,
    limits,
    stopCheckIntervalMs = CONVERSATION_RUN_STOP_CHECK_INTERVAL_MS,
    apiRetryDelayMs = CONVERSATION_API_RETRY_DELAY_MS,
    connectModules = connectConversationModules,
    toolTimeoutMs = CONVERSATION_TOOL_CALL_TIMEOUT_MS,
    createIntegrationRunners = createConversationIntegrationRunners,
  }: Options = {},
): Promise<'finished' | 'held'> {
  const context = await readContext(reference)
  const [run] = context.conversationRuns
  const isSubagent = Boolean(context.conversation?.parentId)

  // Delivered again after its chain's next run could not be queued, or a crash right after the chain
  if (run?.status === ConversationRunStatus.CHAINED) return queueChainedRun(reference)

  if (!run || !isInFlight(run.status)) return 'finished'
  if (run.status === ConversationRunStatus.RUNNING && !isPast(run.leaseExpiresAt)) return 'held'

  if (!isClaimable(context, run.membershipCreatedAt)) {
    return interruptBeforeClaiming(reference, run.attempts, context, retryDelayMs, isSubagent)
  }

  const claim = run.status === ConversationRunStatus.QUEUED ? claimQueuedConversationRun : reclaimConversationRun
  const { data } = await claim(dataConnect, {
    ...reference,
    attempts: run.attempts,
    membershipCreatedAt: run.membershipCreatedAt,
  })

  // Another worker claimed it first, or its author changed between the read and the claim, whose
  // run nothing else would end: a removed author's can no longer reach its page to reconcile it. A
  // suspension landing between the two claims it all the same, and asked it to stop, which its first
  // step reads
  if (data.conversationRun_updateMany !== 1) {
    const claimedContext = await readContext(reference)
    const [claimedRun] = claimedContext.conversationRuns

    if (
      claimedRun
      && isInFlight(claimedRun.status)
      && claimedRun.attempts === run.attempts
      && !isClaimable(claimedContext, claimedRun.membershipCreatedAt)
    ) {
      return interruptBeforeClaiming(reference, claimedRun.attempts, claimedContext, retryDelayMs, isSubagent)
    }

    return 'held'
  }

  const fence: ConversationRunFence = {
    ...reference,
    attempts: run.attempts + 1,
    membershipCreatedAt: run.membershipCreatedAt,
  }
  let modules: ConversationModules

  // Its claimed lease lapses, and the run is claimed again on its next delivery
  try {
    modules = await connectModules(fence)
  } catch (error) {
    logger.error(`Conversation run ${fence.runId}: could not connect to its modules, left to its lease`, error)

    return 'held'
  }

  const controller = new AbortController()
  const lease = createConversationRunLease({ fence, onLost: () => controller.abort() })
  let outcome: Awaited<ReturnType<typeof takeSteps>>

  try {
    outcome = await takeSteps({
      fence,
      lease,
      signal: controller.signal,
      client,
      retryDelayMs,
      limits: { ...LIMITS, ...(isSubagent ? readSubagentRunLimits() : {}), ...limits },
      stopCheckIntervalMs,
      apiRetryDelayMs,
      config: isSubagent
        ? {
            system: SUBAGENT_SYSTEM_PROMPT,
            tools: buildSubagentTools(modules.tools),
            settings: readSubagentRequestSettings(),
          }
        : { system: CONVERSATION_SYSTEM_PROMPT, tools: buildConversationTools(modules.tools) },
      // The integration tools' runners always, whatever the organization added, so a turn is planned
      // the same by whoever takes it over, a subagent's acting as its member under its own fence. A
      // subagent is sent none of the module tools it never gets, so a call to one is planned as a call
      // to a tool nobody runs
      runners: [
        ...createIntegrationRunners(fence),
        ...(isSubagent ? modules.runners.filter(runner => isSubagentTool(runner.name)) : modules.runners),
      ],
      toolTimeoutMs,
      isSubagent,
    })
  } finally {
    await lease.stop()
    await modules.close()
  }

  // The next run takes over once this one's lease has stopped
  return outcome === 'chained' ? queueChainedRun(fence) : outcome
}

/*
  Queues the run a subagent's run chained to, and answers `finished` once it is, or `held` while it
  cannot be, so Cloud Tasks delivers the chained run again, which queues it then
*/
async function queueChainedRun(reference: ConversationRunReference) {
  const next = { ...toReference(reference), runId: deriveChainedRunId(reference.runId) }

  if (await enqueueRun(next, 'subagent-runs')) return 'finished'

  logger.warn(`Conversation run ${reference.runId}: the run it chained to could not be queued, left for its delivery`)

  return 'held'
}

type StepsInput = {
  fence: ConversationRunFence
  lease: ConversationRunLease
  signal: AbortSignal
  client: ClaudeClient
  retryDelayMs: number
  limits: ConversationRunLimits
  stopCheckIntervalMs: number
  apiRetryDelayMs: number
  // What the run's requests send besides their messages, and what runs their calls
  config: ConversationRequestConfig
  runners: ConversationToolRunner[]
  toolTimeoutMs: number
  // Whether the conversation is a subagent: its run asks no question, tags nothing, counts no unread
  // reply and ends with its report
  isSubagent: boolean
}

async function takeSteps({
  fence,
  lease,
  signal,
  client,
  retryDelayMs,
  limits,
  stopCheckIntervalMs,
  apiRetryDelayMs,
  config,
  runners,
  toolTimeoutMs,
  isSubagent,
}: StepsInput): Promise<'finished' | 'held' | 'chained'> {
  const reference = toReference(fence)
  let failedSteps = 0
  // What a request came to and is not written yet
  let outcome: ConversationTurnOutcome | null = null

  for (let step = 0; step < MAX_RUN_STEPS; step++) {
    const context = await readContext(reference)
    const [run] = context.conversationRuns

    // Chained by this worker's own write, whose answer was lost
    if (run?.status === ConversationRunStatus.CHAINED && run.attempts === fence.attempts) return 'chained'
    if (run?.status !== ConversationRunStatus.RUNNING || run.attempts !== fence.attempts) return 'finished'

    try {
      const result = await takeStep({
        context,
        fence,
        lease,
        signal,
        client,
        limits,
        stopCheckIntervalMs,
        apiRetryDelayMs,
        config,
        runners,
        toolTimeoutMs,
        isSubagent,
        outcome,
      })

      outcome = result === 'ended' || result === 'chained' || result === 'next' ? null : result
      failedSteps = 0

      if (result === 'ended') return 'finished'
      if (result === 'chained') return 'chained'
    } catch (error) {
      failedSteps++

      if (failedSteps === MAX_FAILED_STEPS) {
        logger.error(`Conversation run ${fence.runId}: ${failedSteps} steps failed in a row, left to its lease`, error)

        return 'held'
      }

      logger.warn(`Conversation run ${fence.runId}: a step failed, and is read again`, error)

      await wait(failedSteps * retryDelayMs)
    }
  }

  logger.error(`Conversation run ${fence.runId}: took ${MAX_RUN_STEPS} steps without ending, left to its lease`)

  return 'held'
}

type StepInput = Omit<StepsInput, 'retryDelayMs'> & {
  context: ConversationRunContext
  // What a request came to and is not written yet, which this step writes
  outcome: ConversationTurnOutcome | null
}

/*
  Takes the run's next step, and answers `ended` once it ended the run, `chained` once a subagent's
  run handed on to the next, `next` when there is another, or what a request came to, for the next
  step to write. A run whose author left, or whose conversation was deleted, ends first, a turn not
  written yet included
*/
async function takeStep({
  context,
  fence,
  lease,
  signal,
  client,
  limits,
  stopCheckIntervalMs,
  apiRetryDelayMs,
  config,
  runners,
  toolTimeoutMs,
  isSubagent,
  outcome,
}: StepInput): Promise<'ended' | 'chained' | 'next' | ConversationTurnOutcome> {
  const { conversation } = context
  const [run] = context.conversationRuns
  const [entry] = context.conversationTranscriptEntries
  const position = conversation?.nextMessagePosition ?? 0
  // A request a worker reserved and never settled was sent, and is charged as such, unless the
  // worker holds what it came to
  const usage = readOutcomeUsage(outcome) ?? chargeUnsettledRequests(parseConversationRunUsage(run?.usage))

  // With the results the turn's calls kept, when the ten minutes came between them
  function end(ending: ConversationRunEnding, pendingToolResults: string | null = null) {
    return endConversationRun({
      ending,
      fence,
      lease,
      position,
      isSubagent,
      parentId: context.conversation?.parentId ?? null,
      chain: readChain(context, isSubagent, pendingToolResults),
    })
  }

  // Its member asked it to stop, which a run reads before each request and each call: what was
  // paid for is written and drawn first, and nothing more is asked or run
  function stop(failure = 'Its member stopped it before its next request') {
    return end({
      kind: 'noted',
      status: ConversationRunStatus.STOPPED,
      noteKind: ConversationNoteKind.STOPPED,
      failure,
      usage,
    })
  }

  if (!isAuthorStill(context, fence.membershipCreatedAt)) {
    return end({
      kind: 'interrupted',
      reference: toReference(fence),
      attempts: fence.attempts,
      failure: describeAuthorChange(context, fence.membershipCreatedAt),
    })
  }

  if (!conversation || conversation.deletedAt) {
    return end({ kind: 'finished', status: ConversationRunStatus.STOPPED, usage })
  }

  if (outcome) return (await writeOutcome({ outcome, context, fence, lease, isSubagent })) ?? 'next'

  if (!entry) throw new Error('A run answers a transcript, and its conversation has none')
  if (entry.role === ConversationTranscriptRole.SYSTEM) throw new Error('A transcript never ends on a context message')

  if (entry.role === ConversationTranscriptRole.ASSISTANT) {
    // What followed the run's anchor, which a resumed run shares with the run it carries on: its
    // replies, each that called tools followed by the results that answer them
    const sinceAnchor = await readConversationTranscript(toReference(fence), {
      afterPosition: run?.anchorPosition ?? -1,
    })
    const parts = sinceAnchor
      .filter(({ role }) => role === ConversationTranscriptRole.ASSISTANT)
      .map(part => ({ ...part, blocks: parseTranscriptContent(part.content) }))
    // The reply the transcript ends on is its parts after the last results, or after the anchor, and
    // a subagent's last when those results asked for its report
    const lastResults = sinceAnchor.findLast(({ role }) => role === ConversationTranscriptRole.USER)
    const isReportReply = carriesSubagentReportRequest(lastResults)
    const plans = planCalls(parts, runners, isSubagent, readMaxCalls(context, isSubagent), {
      reportRequestPosition: isReportReply ? (lastResults?.position ?? null) : null,
    })
    const drawn = await drawConversationTurn({ fence, lease, entries: parts, plans, position, isSubagent })

    if (drawn === 'drawn') return 'next'

    const turn = parts.filter(({ position: partPosition }) => partPosition > (lastResults?.position ?? -1))
    const ledgers = await readTurnLedgers(fence, turn, usage)
    const pausedRequest = findPausedRequest(entry, ledgers)
    const startedAt = run?.startedAt ?? new Date().toISOString()

    if (!pausedRequest) {
      const calls = readConversationToolCalls(parts.at(-1)?.blocks ?? [])

      // The reply to a subagent's report request is its run's last, and nothing it calls runs: the
      // run ends at its limits, its report its text
      if (isReportReply && calls.length) {
        return end({
          kind: 'noted',
          status: ConversationRunStatus.FAILED,
          noteKind: ConversationNoteKind.FAILED,
          failure: `The reply to its report request called ${calls.length} tools, which never ran`,
          usage,
          isAtLimit: true,
        })
      }

      const turnPlans = calls.flatMap(call => plans.get(call.id) ?? [])
      // Read from what the thread drew, since an approval is drawn only once the server is read
      const isWaiting = calls.length ? await isWaitingForMember(fence, calls) : false
      const isEnding = !calls.length || isWaiting

      // The first exchange is whole, and the reply ends the run, done or waiting for an answer:
      // Claude tags the conversation first, before the calls beside a question run, so none runs
      // twice
      if (isEnding && !isSubagent && shouldTag({ context, usage, startedAt, limits })) {
        return requestConversationTagging({
          fence,
          lease,
          signal,
          client,
          usage,
          reply: parts.flatMap(({ blocks }) => blocks),
          streamDeadline: Date.parse(startedAt) + limits.streamDeadlineMs,
          stopCheckIntervalMs,
          maxCostMicrodollars: limits.maxCostMicrodollars,
        })
      }

      if (!calls.length) return end({ kind: 'finished', status: ConversationRunStatus.COMPLETED, usage })

      const ran = await runConversationToolCalls({
        fence,
        lease,
        signal,
        plans: turnPlans,
        runners,
        deadline: Date.parse(startedAt) + limits.maxDurationMs,
        timeoutMs: toolTimeoutMs,
      })

      // A question or an approval is on the member's screen already, so the run waits for its
      // answer whatever else happened: a call a stop or the run's time kept from running is answered
      // as stopped, and cancelled, which the preview says when it shows that call
      if (isWaiting) {
        const shown = ran.messages.find(({ id }) => id === conversation.previewMessageId)
        const isShownCancelled =
          shown?.kind === ConversationMessageKind.TOOL_CALL
          && !ran.pending.has(shown.toolUseId ?? '')
          && (shown.toolStatus === ConversationToolStatus.RUNNING
            || shown.toolStatus === ConversationToolStatus.CANCELLED)

        return end({
          kind: 'waiting',
          usage,
          ...(isShownCancelled
            ? {
                preview: buildConversationPreview({
                  kind: 'TOOL_CALL',
                  toolName: shown.toolName,
                  toolStatus: ConversationToolStatus.CANCELLED,
                  integrationName: shown.integrationName,
                }),
              }
            : {}),
        })
      }
      if (ran.outcome === 'stopped') return stop('Its member stopped it before its next call')

      const isLastSubagentRun = isSubagent && run?.number === MAX_SUBAGENT_RUNS - 1
      // A subagent's last run its ten minutes stopped between calls answers those it kept from
      // starting, and asks for its report, while that request has the time to go
      const isReportedAtTimeLimit =
        ran.outcome === 'expired' && isLastSubagentRun && Date.now() < readSubagentReportDeadline(startedAt, limits)

      if (ran.outcome === 'expired' && !isReportedAtTimeLimit) {
        return end(
          {
            kind: 'noted',
            status: ConversationRunStatus.FAILED,
            noteKind: ConversationNoteKind.FAILED,
            failure: `The run passed ${limits.maxDurationMs / 1000} seconds since it was first claimed, before its next call`,
            usage,
            isAtLimit: true,
          },
          ran.pending.size ? serializePendingToolResults(ran.pending) : null,
        )
      }

      const results = buildConversationToolResults({
        calls,
        messages: ran.messages,
        pending: ran.pending,
        skipsQuestions: false,
        ...(isReportedAtTimeLimit ? { unrunResult: UNRUN_AT_TIME_LIMIT_CALL_RESULT } : {}),
      })
      /*
        A run an answer started that stores the results of a turn another run drew carried a waiting
        turn on to make the calls its member allowed, and is anchored on those results from then on,
        as a run its answers' entry started is: checked first, as that entry is checked before it is
        stored. Its entry is the answer's, so it carries the reports of the conversation's subagents
        waiting after the results, as an answer's entry does. A resume carries on the turn of the run
        it resumes too, and keeps that run's anchor
      */
      const isReanchored =
        run?.trigger === ConversationRunTrigger.ANSWER
        && toCanonicalUuid(entry.run?.id ?? '') !== toCanonicalUuid(fence.runId)
      const reports = isReanchored ? await readWaitingReports(fence) : { ids: [], blocks: [] }
      // A subagent's fourth run asks for its report once one of its budgets nears its end, so its
      // next request, its last, is answered with the report, calling nothing
      const isReportDue =
        isLastSubagentRun
        && (isReportedAtTimeLimit
          || isSubagentReportDue({
            usage,
            limits,
            startedAt,
            entryCount: context.conversationMessages.length,
            resultsLength: serializeTranscriptContent(results).length,
            model: (config.settings ?? CONVERSATION_REQUEST_SETTINGS).model,
          }))
      const content = isReportDue
        ? [...results, { type: 'text' as const, text: SUBAGENT_REPORT_REQUEST }]
        : [...results, ...reports.blocks]

      if (isReanchored) {
        checkTranscript(
          [
            { role: 'assistant', content: parts.at(-1)?.blocks as BetaMessageParam['content'] },
            { role: 'user', content: results as BetaMessageParam['content'] },
          ],
          { isRequest: false, isTail: true },
        )
      }

      await lease.write(() =>
        storeConversationToolResults(dataConnect, {
          ...fence,
          entryId: randomUUID().replaceAll('-', ''),
          position: entry.position + 1,
          content: serializeTranscriptContent(content),
          ...(isReanchored && { anchorPosition: entry.position + 1 }),
          deliveredSubagentIds: reports.ids,
        }),
      )

      return 'next'
    }

    if (run?.stopRequestedAt) return stop()

    return requestConversationTurn({
      fence,
      lease,
      signal,
      client,
      config,
      runContext: run?.context ?? null,
      usage,
      pausedRequest,
      storedPauses: countStoredPauses(turn, ledgers),
      startedAt,
      limits,
      stopCheckIntervalMs,
      apiRetryDelayMs,
    })
  }

  if (run?.stopRequestedAt) return stop()

  // A subagent's request for its report, which the entry asked for, goes past the run's entries
  if (!carriesSubagentReportRequest(entry) && context.conversationMessages.length >= MAX_CONVERSATION_RUN_ENTRIES) {
    return end({
      kind: 'noted',
      status: ConversationRunStatus.FAILED,
      noteKind: ConversationNoteKind.FAILED,
      failure: `The run drew its ${MAX_CONVERSATION_RUN_ENTRIES} entries`,
      usage,
      isAtLimit: true,
    })
  }

  if (conversation.messageCount >= MAX_CONVERSATION_MESSAGES) {
    return end({
      kind: 'noted',
      status: ConversationRunStatus.FAILED,
      noteKind: ConversationNoteKind.FULL,
      failure: `The conversation holds its ${MAX_CONVERSATION_MESSAGES} messages`,
      usage,
    })
  }

  return requestConversationTurn({
    fence,
    lease,
    signal,
    client,
    config,
    runContext: run?.context ?? null,
    usage,
    pausedRequest: null,
    storedPauses: 0,
    startedAt: run?.startedAt ?? new Date().toISOString(),
    limits,
    stopCheckIntervalMs,
    apiRetryDelayMs,
  })
}

type WriteOutcomeInput = {
  outcome: ConversationTurnOutcome
  context: ConversationRunContext
  fence: ConversationRunFence
  lease: ConversationRunLease
  isSubagent: boolean
}

// Writes what a request came to, and answers whether that ended or chained the run, or null
async function writeOutcome({ outcome, context, fence, lease, isSubagent }: WriteOutcomeInput) {
  if (outcome.kind === 'tagging') {
    await writeTagging({ outcome, context, fence, lease })

    return null
  }

  if (outcome.kind === 'ending') {
    return endConversationRun({
      ending: outcome.ending,
      fence,
      lease,
      position: context.conversation?.nextMessagePosition ?? 0,
      isSubagent,
      parentId: context.conversation?.parentId ?? null,
      chain: readChain(context, isSubagent, null),
    })
  }

  await storeConversationParts({
    fence,
    lease,
    turn: outcome,
    storedEntryIds: new Set(context.runEntries.map(({ id }) => id)),
  })

  return null
}

/*
  What a subagent's run hands on to at one of its limits, as the step read it, null for its fourth
  run and for a conversation's: its number and anchor, and the results its turn's calls kept
*/
function readChain(
  { conversationRuns: [run] }: ConversationRunContext,
  isSubagent: boolean,
  pendingToolResults: string | null,
): SubagentChain | null {
  if (!isSubagent || !run || run.number >= MAX_SUBAGENT_RUNS - 1) return null

  return { runNumber: run.number, anchorPosition: run.anchorPosition, pendingToolResults }
}

// How many calls the turns since the run's anchor make in all: 50 for each run a subagent's chain
// has taken, its runs numbered from 0 on one anchor, and 50 for any other run
function readMaxCalls({ conversationRuns: [run] }: ConversationRunContext, isSubagent: boolean) {
  return MAX_TOOL_CALLS_PER_RUN * (isSubagent ? (run?.number ?? 0) + 1 : 1)
}

/*
  Writes what the tagging request came to: the aspects it picked, with their note, while nobody has
  set the conversation's aspects and it has room for the note, or its ledger alone otherwise, so
  the request is settled whatever it answered. A tag refused because the member's note moved the
  counter meanwhile is read again by the next step, which then finds the member's aspects
*/
async function writeTagging({
  outcome,
  context: { conversation },
  fence,
  lease,
}: Omit<WriteOutcomeInput, 'isSubagent'> & { outcome: Extract<ConversationTurnOutcome, { kind: 'tagging' }> }) {
  const { aspects, usage } = outcome

  if (aspects && conversation && !conversation.aspectsSetBy && conversation.messageCount < MAX_CONVERSATION_MESSAGES) {
    await lease.write(() =>
      tagConversationAspects(dataConnect, {
        ...fence,
        usage,
        aspects,
        noteId: deriveConversationMessageId(fence.runId, 'aspects'),
        position: conversation.nextMessagePosition,
      }),
    )

    return
  }

  const { data } = await lease.write(() => renewConversationRunLease(dataConnect, { ...fence, usage }))

  if (data.conversationRun_updateMany !== 1) {
    throw new Error(
      `Conversation run ${fence.runId}: its tagging's ledger renewed nothing, the run is not this worker's`,
    )
  }
}

/*
  Whether the run tags its conversation once its reply ends it: a run answering the conversation's
  first message, its first or one carrying it on, a resume or a retry, while nobody has set its
  aspects and it has room for the note. Not once its member asked to stop it, nor at its limits, its
  25 requests or its 10 minutes, and once a run, which its ledger says
*/
function shouldTag({
  context: { conversation, conversationRuns },
  usage,
  startedAt,
  limits,
}: {
  context: ConversationRunContext
  usage: ConversationRunUsage
  startedAt: string
  limits: ConversationRunLimits
}) {
  const [run] = conversationRuns

  return (
    run?.anchorPosition === 0
    && !run.stopRequestedAt
    && !!conversation
    && !conversation.aspectsSetBy
    && conversation.messageCount < MAX_CONVERSATION_MESSAGES
    && !usage.requests.some(({ purpose }) => purpose === 'tagging')
    && usage.requests.length < limits.maxRequests
    && Date.now() - Date.parse(startedAt) < limits.maxDurationMs
  )
}

function readOutcomeUsage(outcome: ConversationTurnOutcome | null) {
  if (!outcome) return null
  if (outcome.kind === 'turn' || outcome.kind === 'tagging') return outcome.usage

  return outcome.ending.kind === 'interrupted' ? null : (outcome.ending.usage ?? null)
}

/*
  Whether the turn the transcript ends on waits for the run's member: one of its questions not
  answered, or one of its calls to an integration waiting for their approval, as the thread drew them
*/
async function isWaitingForMember(fence: ConversationRunFence, calls: { id: string }[]) {
  const { organizationId, userId, conversationId } = fence
  const { data } = await getConversationCalls(dataConnect, {
    organizationId,
    userId,
    conversationId,
    toolUseIds: calls.map(({ id }) => id),
  })

  return data.conversationMessages.some(
    message =>
      (message.kind === ConversationMessageKind.QUESTION || message.kind === ConversationMessageKind.APPROVAL)
      && !message.answeredAt,
  )
}

/*
  What becomes of each call the run's replies made to Strategy Dance's own tools, by its id, as
  `planConversationToolCalls` plans it, counting each reply's calls after those of the replies
  before it, within the run's budget (`readMaxCalls`). A subagent's questions are refused, since
  nobody answers them, and so is every call of the reply after the entry asking for its report
*/
function planCalls(
  parts: { position: number; blocks: ConversationContentBlock[] }[],
  runners: ConversationToolRunner[],
  isSubagent: boolean,
  maxCalls: number,
  { reportRequestPosition }: { reportRequestPosition: number | null },
) {
  const plans = new Map<string, ConversationToolCallPlan>()
  const runnerNames = runners.map(({ name }) => name)
  let callsBefore = 0

  for (const { position, blocks } of parts) {
    const calls = readConversationToolCalls(blocks)

    for (const plan of planConversationToolCalls(calls, {
      callsBefore,
      runnerNames,
      asksQuestions: !isSubagent,
      maxCalls,
      isReportReply: reportRequestPosition !== null && position > reportRequestPosition,
    })) {
      plans.set(plan.call.id, plan)
    }

    callsBefore += calls.length
  }

  return plans
}

/*
  The ledgers that say how each of the turn's parts ended: this run's as the worker holds it, and
  those of the runs it carries the turn of, which crashes may have left several of, each with a
  part paused
*/
async function readTurnLedgers(fence: ConversationRunFence, turn: { runId: string }[], usage: ConversationRunUsage) {
  const ledgers = new Map([[fence.runId, usage]])
  const runIds = [...new Set(turn.map(({ runId }) => runId))].filter(runId => runId !== fence.runId)

  if (!runIds.length) return ledgers

  const { organizationId, userId, conversationId } = fence
  const { data } = await getConversationRunLedgers(dataConnect, { organizationId, userId, conversationId, runIds })

  for (const run of data.conversationRuns) ledgers.set(run.id, parseConversationRunUsage(run.usage))

  return ledgers
}

// The request whose part the transcript ends on, as the ledger of the run that stored it says,
// when `pause_turn` paused it: a crash came between storing it and the turn's next part
function findPausedRequest(
  entry: { position: number; run: { id: string } },
  ledgers: Map<string, ConversationRunUsage>,
) {
  return (
    ledgers
      .get(entry.run.id)
      ?.requests.find(({ turnPosition, stopReason }) => turnPosition === entry.position && stopReason === 'pause_turn')
    ?? null
  )
}

// How many of the turn's stored parts paused, each as its own run's ledger says, which count toward
// its five pauses
function countStoredPauses(turn: { position: number; runId: string }[], ledgers: Map<string, ConversationRunUsage>) {
  return turn.filter(({ position, runId }) =>
    ledgers
      .get(runId)
      ?.requests.some(({ turnPosition, stopReason }) => turnPosition === position && stopReason === 'pause_turn'),
  ).length
}

/*
  Ends a run whose author is no longer the member it was queued under before any worker claims it,
  at the attempt read. Read again and tried again when it is refused, since the note's counter may
  have moved: a run something else ended meanwhile is left as it is
*/
async function interruptBeforeClaiming(
  reference: ConversationRunReference,
  attempts: number,
  firstContext: ConversationRunContext,
  retryDelayMs: number,
  isSubagent: boolean,
) {
  let context = firstContext

  for (let failedTries = 1; ; failedTries++) {
    try {
      await endConversationRun({
        ending: {
          kind: 'interrupted',
          reference,
          attempts,
          failure: describeAuthorChange(context, context.conversationRuns[0]?.membershipCreatedAt ?? ''),
        },
        fence: null,
        lease: null,
        position: context.conversation?.nextMessagePosition ?? 0,
        isSubagent,
        parentId: context.conversation?.parentId ?? null,
      })

      return 'finished'
    } catch (error) {
      if (failedTries === MAX_FAILED_STEPS) {
        logger.error(`Conversation run ${reference.runId}: could not be interrupted, left to its lease`, error)

        return 'held'
      }

      await wait(failedTries * retryDelayMs)

      context = await readContext(reference)

      const [run] = context.conversationRuns

      if (!run || !isInFlight(run.status) || run.attempts !== attempts) return 'finished'
    }
  }
}

async function readContext(reference: ConversationRunReference) {
  const { data } = await getConversationRunContext(dataConnect, reference)

  return data
}

// The run's keys alone, which a read takes
function toReference({ organizationId, userId, conversationId, runId }: ConversationRunReference) {
  return { organizationId, userId, conversationId, runId }
}

function isInFlight(status: ConversationRunStatus) {
  return status === ConversationRunStatus.QUEUED || status === ConversationRunStatus.RUNNING
}

// The reports of a conversation's subagents waiting to be delivered, each one JSON block, which an
// answer's entry carries after its results, and their subagents, which its write marks delivered
async function readWaitingReports(fence: ConversationRunFence) {
  const { data } = await getSubagentReactionContext(dataConnect, {
    organizationId: fence.organizationId,
    userId: fence.userId,
    conversationId: fence.conversationId,
  })
  const waiting = data.subagents.filter(isWaitingReport)
  const blocks = await readSubagentReportBlocks(fence, waiting)

  return { ids: waiting.map(({ id }) => toCanonicalUuid(id)), blocks }
}

function isPast(time: string | null | undefined) {
  return Boolean(time) && Date.parse(time ?? '') < Date.now()
}

// Why a run's author no longer passes for it, for the logs
function describeAuthorChange(context: ConversationRunContext, membershipCreatedAt: string) {
  if (!context.userOrganization) return 'Its author left the organization'
  if (context.userOrganization.createdAt !== membershipCreatedAt)
    return 'Its author was invited back since it was queued'
  if (context.user?.conversationsSuspendedAt) return 'Its author’s conversations are suspended'

  return 'Its organization’s conversations are suspended'
}

/*
  Whether a worker may claim the run: its author still passes for it, and staff suspended
  conversations neither for their account nor in the organization. Only the claim reads the
  suspension, never the steps after it, which would throw away a turn already paid for: the
  suspension asked the runs in flight to stop, which each reads before its next request
*/
function isClaimable(context: ConversationRunContext, membershipCreatedAt: string) {
  return (
    isAuthorStill(context, membershipCreatedAt)
    && !context.user?.conversationsSuspendedAt
    && !context.organization?.conversationsSuspendedAt
  )
}

// Whether the run's author is still the member it was queued under
function isAuthorStill(context: ConversationRunContext, membershipCreatedAt: string) {
  return context.userOrganization?.createdAt === membershipCreatedAt
}

export default runConversation
