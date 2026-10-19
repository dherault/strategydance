import { MAX_TOOL_CALLS_PER_RUN, MAX_TOOL_CALLS_PER_TURN } from 'strategydance-core'

import checkConversationIntegrationCall, {
  type ConversationIntegrationCall,
} from '~domain/agent/checkConversationIntegrationCall'
import checkConversationQuestion, { type ConversationQuestion } from '~domain/agent/checkConversationQuestion'
import { ASK_USER_TOOL_NAME, CALL_INTEGRATION_TOOL_TOOL_NAME } from '~domain/agent/conversationTools'
import type { ConversationToolCall } from '~domain/agent/readConversationToolCalls'

/*
  What becomes of one of a turn's calls:

  - `question`: an `ask_user` within its bounds, drawn as a question the member answers
  - `run`: a call to a tool the worker runs, drawn as a call that runs
  - `integration`: a call to an integration's tool, within its bounds, drawn once the server is read:
    as a call that runs when an administrator lets the tool run without approval, as an approval the
    member answers otherwise, or as a call that failed when the member cannot use the server
  - `refused`: a call nothing runs, answered with `reason`, drawn as a call that failed when
    `isDrawn`, or not at all for a question past its bounds, so nothing of it reaches the thread
*/
export type ConversationToolCallPlan =
  | { kind: 'question'; call: ConversationToolCall; question: ConversationQuestion }
  | { kind: 'run'; call: ConversationToolCall }
  | { kind: 'integration'; call: ConversationToolCall; integrationCall: ConversationIntegrationCall }
  | { kind: 'refused'; call: ConversationToolCall; reason: string; isDrawn: boolean }

type Options = {
  // How many calls the turns before it made since the run's anchor, which a resumed run shares
  // with the run it carries on
  callsBefore: number
  // The tools the worker runs
  runnerNames: string[]
  // Whether anybody answers a question, which nobody does a subagent's: its `ask_user`, a tool it is
  // never sent, is then refused as one nobody runs
  asksQuestions?: boolean
  // How many calls the turns since the anchor run in all: 50 for a run, and for a subagent's 50 for
  // each run its chain has taken, since its runs share their anchor
  maxCalls?: number
  // Whether the turn answers a subagent's report request, after which no call runs
  isReportReply?: boolean
}

/*
  What becomes of each of a turn's calls, from the transcript alone, so a worker taking over after a
  crash plans the same. A question past its bounds is never drawn, whatever else holds. A turn runs
  at most 10 calls, and the turns answering one member's entry 50, questions included, or as many as
  `maxCalls` says for a subagent's chain: a call past either is drawn as failed and answered as not
  run. A call to a tool nobody runs is drawn as failed, and so is every call of a reply to a
  subagent's report request, its run's last
*/
function planConversationToolCalls(
  calls: ConversationToolCall[],
  { callsBefore, runnerNames, asksQuestions = true, maxCalls = MAX_TOOL_CALLS_PER_RUN, isReportReply = false }: Options,
): ConversationToolCallPlan[] {
  return calls.map((call, index) => {
    // Checked before the limits, so a question past its bounds never reaches the thread
    const checked = asksQuestions && call.name === ASK_USER_TOOL_NAME ? checkConversationQuestion(call.input) : null

    if (checked?.outcome === 'invalid') return { kind: 'refused', call, reason: checked.reason, isDrawn: false }

    if (isReportReply)
      return refuse(call, 'Not run: your last request asked for your report, and no call runs after it.')

    if (index >= MAX_TOOL_CALLS_PER_TURN) {
      return refuse(
        call,
        `Not run: a turn runs at most ${MAX_TOOL_CALLS_PER_TURN} calls. Call it again if you still need it.`,
      )
    }

    if (callsBefore + index >= maxCalls) {
      return refuse(call, `Not run: a response runs at most ${maxCalls} calls. Answer with what you have.`)
    }

    if (checked?.outcome === 'valid') return { kind: 'question', call, question: checked.question }

    if (!runnerNames.includes(call.name)) return refuse(call, `Not run: there is no tool called ${call.name}.`)

    if (call.name === CALL_INTEGRATION_TOOL_TOOL_NAME) {
      const integrationCall = checkConversationIntegrationCall(call.input)

      if (integrationCall.outcome === 'invalid') return refuse(call, integrationCall.reason)

      return { kind: 'integration', call, integrationCall: integrationCall.call }
    }

    return { kind: 'run', call }
  })
}

function refuse(call: ConversationToolCall, reason: string): ConversationToolCallPlan {
  return { kind: 'refused', call, reason, isDrawn: true }
}

export default planConversationToolCalls
