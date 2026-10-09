import { buildConversationPreview } from 'strategydance-core'
import {
  ConversationMessageKind,
  ConversationToolStatus,
  type GetConversationCallsData,
  finishConversationToolCall,
  getConversationCalls,
  getConversationRunStop,
  startConversationToolCall,
} from 'strategydance-database/backend'

import type { ConversationRunFence, ConversationToolRunner } from '~types'

import { CONVERSATION_READ_CALLS_AT_ONCE } from '~constants'

import { dataConnect } from '~firebase'

import type { ConversationToolCallPlan } from '~domain/agent/planConversationToolCalls'
import type { ConversationToolCall } from '~domain/agent/readConversationToolCalls'
import {
  type ConversationToolResult,
  parsePendingToolResults,
  serializePendingToolResults,
  toFailedOutput,
  toFailedResult,
  toSucceededResult,
  toToolOutput,
} from '~domain/conversations/conversationToolResults'
import type { ConversationRunLease } from '~domain/conversations/createConversationRunLease'

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

  Each call starts in a fenced write, so a worker that lost its run never makes one, and finishes in
  another that records its result on its message and on the run, with the results kept before it,
  so a worker taking over runs none of them again. A call has 60 seconds: past them it fails, and
  whatever it answers later changes nothing. A failure goes back to Claude as a sentence it can act
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
  const calls = plans.flatMap(plan => {
    const message = messages.get(plan.call.id)
    const runner = runnersByName.get(plan.call.name)

    if (plan.kind !== 'run' || pending.has(plan.call.id) || !runner) return []
    if (!message) throw new Error(`Call ${plan.call.id} runs once it is drawn`)
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
      group.map(({ call, messageId, runner }) =>
        runCall({ fence, lease, signal, call, messageId, runner, pending, timeoutMs }),
      ),
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
async function runCall({ fence, lease, signal, call, messageId, runner, pending, timeoutMs }: RunCallInput) {
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

    const reason = timeout.aborted
      ? `The call took longer than ${timeoutMs / 1000} seconds, and was stopped.`
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
