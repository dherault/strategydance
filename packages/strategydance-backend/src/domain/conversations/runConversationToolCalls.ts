import { buildConversationPreview } from 'strategydance-core'
import {
  ConversationApprovalState,
  ConversationMessageKind,
  ConversationToolStatus,
  type GetConversationCallsData,
  finishConversationIntegrationCall,
  finishConversationToolCall,
  getConversationCalls,
  getConversationRunStop,
  startConversationIntegrationCall,
  startConversationToolCall,
} from 'strategydance-database/backend'

import type { ConversationDrawnCall, ConversationRunFence, ConversationToolRunner } from '~types'

import { CONVERSATION_READ_CALLS_AT_ONCE } from '~constants'

import { dataConnect } from '~firebase'

import type { ConversationToolCallPlan } from '~domain/agent/planConversationToolCalls'
import type { ConversationToolCall } from '~domain/agent/readConversationToolCalls'
import {
  type ConversationToolResult,
  INTERRUPTED_CALL_RESULT,
  parsePendingToolResults,
  serializePendingToolResults,
  toFailedOutput,
  toFailedResult,
  toSucceededResult,
  toToolOutput,
} from '~domain/conversations/conversationToolResults'
import type { ConversationRunLease } from '~domain/conversations/createConversationRunLease'
import IntegrationCallChanged from '~domain/integrations/IntegrationCallChanged'
import IntegrationCallUnanswered from '~domain/integrations/IntegrationCallUnanswered'

type RunConversationToolCallsInput = {
  fence: ConversationRunFence
  lease: ConversationRunLease
  // Aborted once the run is no longer this worker's
  signal: AbortSignal
  // What becomes of each of the turn's calls, in their order
  plans: ConversationToolCallPlan[]
  runners: ConversationToolRunner[]
  // When no call starts any more: the run's time is up
  deadline: number
  // How long a call may take
  timeoutMs: number
}

/*
  What running a turn's calls came to:

  - `ran`: every call that runs has its result, kept on the run with those that finished before
  - `stopped`: its member asked it to stop, so the calls not started yet were left as they are
  - `expired`: the run's time was up, so the calls not started yet were left as they are

  The calls as the thread drew them, read before any ran, and the results the run keeps, come back
  with it
*/
export type ConversationToolCallsOutcome = {
  outcome: 'ran' | 'stopped' | 'expired'
  messages: GetConversationCallsData['conversationMessages']
  pending: Map<string, ConversationToolResult>
}

/*
  Runs a turn's calls to Strategy Dance's own tools, those its plan runs and that have no result
  yet: one drawn and never started, one a crash left started, which runs again, and one a stop
  cancelled, which a resumed run runs. In the turn's order, consecutive calls that only read four at
  a time, side by side, and each that writes alone, so writes land in the order Claude made them.

  A call to an integration runs only as the message it was drawn as allows: one that runs without
  approval, or one the member allowed, and never one waiting for the member or denied. It went to
  another company's server, which may have acted on it, so one that started and has no result is
  never made again: it is finished as interrupted, its result saying it may have run.

  Each call starts in a fenced write, so a worker that lost its run never makes one, and finishes in
  another that records its result on its message and on the run, with the results kept before it,
  so a worker taking over runs none of them again. A call has 60 seconds: past them it fails, and
  whatever it answers later changes nothing, though a write may still land, which its sentence says. A failure goes back to Claude as a sentence it can act
  on.

  Before each group starts, the member's stop and the run's time are read: once either is up, the
  calls not started are left for whatever ends the run
*/
async function runConversationToolCalls({
  fence,
  lease,
  signal,
  plans,
  runners,
  deadline,
  timeoutMs,
}: RunConversationToolCallsInput): Promise<ConversationToolCallsOutcome> {
  const { organizationId, userId, conversationId, runId } = fence
  const { data } = await getConversationCalls(dataConnect, {
    organizationId,
    userId,
    conversationId,
    toolUseIds: plans.map(({ call }) => call.id),
  })
  const pending = parsePendingToolResults(data.latestRuns[0]?.pendingToolResults)
  const messages = new Map(data.conversationMessages.map(message => [message.toolUseId, message]))
  const runnersByName = new Map(runners.map(runner => [runner.name, runner]))
  const calls = plans.flatMap((plan): GroupedCall[] => {
    const message = messages.get(plan.call.id)
    const runner = runnersByName.get(plan.call.name)

    if ((plan.kind !== 'run' && plan.kind !== 'integration') || pending.has(plan.call.id) || !runner) return []
    if (!message) throw new Error(`Call ${plan.call.id} runs once it is drawn`)

    if (plan.kind === 'integration') {
      if (isInterruptedIntegrationCall(message)) {
        return [{ call: plan.call, messageId: message.id, runner, message, isInterrupted: true }]
      }

      return isStartableIntegrationCall(message) ? [{ call: plan.call, messageId: message.id, runner, message }] : []
    }

    if (!isUnfinished(message)) return []

    return [{ call: plan.call, messageId: message.id, runner }]
  })
  const outcome = (kind: ConversationToolCallsOutcome['outcome']) => ({
    outcome: kind,
    messages: data.conversationMessages,
    pending,
  })

  for (const group of groupCalls(calls)) {
    const { data: stop } = await getConversationRunStop(dataConnect, { organizationId, userId, conversationId, runId })

    if (stop.conversationRuns[0]?.stopRequestedAt) return outcome('stopped')
    if (Date.now() >= deadline) return outcome('expired')

    const settled = await Promise.allSettled(
      group.map(grouped => runCall({ ...grouped, fence, lease, signal, pending, timeoutMs })),
    )
    const failure = settled.find(result => result.status === 'rejected')

    if (failure) throw failure.reason
  }

  return outcome('ran')
}

type GroupedCall = {
  call: ConversationToolCall
  messageId: string
  runner: ConversationToolRunner
  // A call to an integration's, drawn as this message, which the call reads what it is bound to from
  message?: ConversationDrawnCall
  // A call to an integration that started and has no result, finished as interrupted, never made again
  isInterrupted?: boolean
}

// Consecutive calls that only read, four at most, and each other call alone
function groupCalls(calls: GroupedCall[]) {
  const groups: GroupedCall[][] = []

  for (const call of calls) {
    const last = groups.at(-1)

    if (
      last
      && call.runner.isReadOnly
      && last.every(({ runner }) => runner.isReadOnly)
      && last.length < CONVERSATION_READ_CALLS_AT_ONCE
    ) {
      last.push(call)
    } else {
      groups.push([call])
    }
  }

  return groups
}

type RunCallInput = GroupedCall & {
  fence: ConversationRunFence
  lease: ConversationRunLease
  signal: AbortSignal
  // The results the run keeps, which a call's own goes into once its write lands
  pending: Map<string, ConversationToolResult>
  timeoutMs: number
}

/*
  Starts a call, makes it, and records what it came to, its result going into the run's kept ones
  once the write that keeps it lands. Writes go through the lease one at a time, so each finishing
  write carries the results of those before it
*/
async function runCall(input: RunCallInput) {
  if (input.message) return runIntegrationCall({ ...input, message: input.message })

  const { fence, lease, signal, call, messageId, runner, pending, timeoutMs } = input
  const { organizationId, userId, conversationId, runId } = fence

  await lease.write(() => startConversationToolCall(dataConnect, { ...fence, messageId }))

  const startedAt = Date.now()
  const timeout = AbortSignal.timeout(timeoutMs)
  const callSignal = AbortSignal.any([signal, timeout])
  let result: ConversationToolResult
  let toolOutput: string

  try {
    const output = await untilAborted(
      runner.run(call.input, {
        signal: callSignal,
        reference: { organizationId, userId, conversationId, runId },
        toolUseId: call.id,
      }),
      callSignal,
    )

    toolOutput = toToolOutput(output)
    result = toSucceededResult(call.id, toolOutput)
  } catch (error) {
    // The run is no longer this worker's, which writes nothing more
    if (signal.aborted) throw error

    // A write the worker stopped waiting for can still land, a module's going on in its own mutation
    const reason = timeout.aborted
      ? runner.isReadOnly
        ? `The call took longer than ${timeoutMs / 1000} seconds, and was stopped.`
        : `The call took longer than ${timeoutMs / 1000} seconds and may still have run. Check before you call it again.`
      : error instanceof Error && error.message
        ? error.message
        : 'The call failed.'

    toolOutput = toFailedOutput(reason)
    result = toFailedResult(call.id, reason)
  }

  const toolStatus = result.is_error ? ConversationToolStatus.FAILED : ConversationToolStatus.SUCCEEDED

  await lease.write(async () => {
    const kept = new Map(pending).set(call.id, result)

    await finishConversationToolCall(dataConnect, {
      ...fence,
      messageId,
      toolStatus,
      toolOutput,
      toolDurationMs: Date.now() - startedAt,
      pendingToolResults: serializePendingToolResults(kept),
      preview: buildConversationPreview({ kind: 'TOOL_CALL', toolName: call.name, toolStatus }),
    })

    pending.set(call.id, result)
  })
}

/*
  Makes a call to an integration's tool, as `runCall` makes any other, through the integration's own
  start and finish: the start marks the server used, and only a call never started starts. A call
  that started and has no result is finished as interrupted rather than made, and recorded, as one
  that timed out or whose server could not be reached, as unanswered, since it may have run. An
  approval whose server, tool or credential changed since the member saw it is denied as it is
  answered, so the thread shows why
*/
async function runIntegrationCall({
  fence,
  lease,
  signal,
  call,
  messageId,
  runner,
  pending,
  timeoutMs,
  message,
  isInterrupted = false,
}: RunCallInput & { message: ConversationDrawnCall }) {
  const { organizationId, userId, conversationId, runId } = fence
  const integrationId = message.integrationId ?? ''
  const isApproval = message.kind === ConversationMessageKind.APPROVAL
  const startedAt = Date.now()
  let result: ConversationToolResult
  let toolOutput: string
  let isDenied = false
  // Whether its server never answered, so it may have run: interrupted, timed out, or not reached
  let isUnanswered = isInterrupted

  if (isInterrupted) {
    toolOutput = toFailedOutput(INTERRUPTED_CALL_RESULT)
    result = toFailedResult(call.id, INTERRUPTED_CALL_RESULT)
  } else {
    await lease.write(() => startConversationIntegrationCall(dataConnect, { ...fence, messageId, integrationId }))

    const timeout = AbortSignal.timeout(timeoutMs)
    const callSignal = AbortSignal.any([signal, timeout])

    try {
      const output = await untilAborted(
        runner.run(call.input, {
          signal: callSignal,
          reference: { organizationId, userId, conversationId, runId },
          toolUseId: call.id,
          message,
        }),
        callSignal,
      )

      toolOutput = toToolOutput(output)
      result = toSucceededResult(call.id, toolOutput)
    } catch (error) {
      if (signal.aborted) throw error

      const reason = timeout.aborted
        ? `The call took longer than ${timeoutMs / 1000} seconds and may still have run. Check before you call it again.`
        : error instanceof Error && error.message
          ? error.message
          : 'The call failed.'

      isDenied = isApproval && error instanceof IntegrationCallChanged
      isUnanswered = timeout.aborted || error instanceof IntegrationCallUnanswered
      toolOutput = toFailedOutput(reason)
      result = toFailedResult(call.id, reason)
    }
  }

  const toolStatus = result.is_error ? ConversationToolStatus.FAILED : ConversationToolStatus.SUCCEEDED

  await lease.write(async () => {
    const kept = new Map(pending).set(call.id, result)

    await finishConversationIntegrationCall(dataConnect, {
      ...fence,
      messageId,
      toolStatus,
      toolOutput,
      ...(!isInterrupted && { toolDurationMs: Date.now() - startedAt }),
      isToolUnanswered: isUnanswered,
      ...(isDenied && { approvalState: ConversationApprovalState.DENIED }),
      pendingToolResults: serializePendingToolResults(kept),
      preview: buildConversationPreview(
        isApproval
          ? {
              kind: 'APPROVAL',
              integrationName: message.integrationName,
              integrationToolName: message.integrationToolName,
              approvalState: isDenied ? ConversationApprovalState.DENIED : message.approvalState,
              toolStatus,
            }
          : { kind: 'TOOL_CALL', toolName: call.name, toolStatus, integrationName: message.integrationName },
      ),
    })

    pending.set(call.id, result)
  })
}

// A call to an integration that never started: one that runs without approval, drawn running or
// cancelled by a stop before it started, or an approval the member allowed
function isStartableIntegrationCall(message: ConversationDrawnCall) {
  if (message.toolStartedAt) return false
  if (message.kind === ConversationMessageKind.APPROVAL) {
    return message.approvalState === ConversationApprovalState.ALLOWED && message.toolStatus === null
  }

  return isUnfinished(message)
}

// A call to an integration that started and has no result, left by a crash or a stop
function isInterruptedIntegrationCall(message: ConversationDrawnCall) {
  return (
    Boolean(message.toolStartedAt)
    && (message.toolStatus === ConversationToolStatus.RUNNING
      || message.toolStatus === ConversationToolStatus.CANCELLED)
  )
}

// A call that runs and has not finished: drawn and never started, started by a worker that crashed,
// or cancelled by a stop
function isUnfinished(message: GetConversationCallsData['conversationMessages'][number]) {
  return (
    message.kind === ConversationMessageKind.TOOL_CALL
    && (message.toolStatus === ConversationToolStatus.RUNNING
      || message.toolStatus === ConversationToolStatus.CANCELLED)
  )
}

// What a call answers, unless its signal is aborted first, its time up or its run lost, when what
// it answers later is dropped
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason)

    if (signal.aborted) {
      abort()

      return
    }

    signal.addEventListener('abort', abort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

export default runConversationToolCalls
