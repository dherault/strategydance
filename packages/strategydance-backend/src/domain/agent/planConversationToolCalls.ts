import { MAX_TOOL_CALLS_PER_RUN, MAX_TOOL_CALLS_PER_TURN } from 'strategydance-core'

import checkConversationQuestion, { type ConversationQuestion } from '~domain/agent/checkConversationQuestion'
import { ASK_USER_TOOL_NAME } from '~domain/agent/conversationTools'
import type { ConversationToolCall } from '~domain/agent/readConversationToolCalls'

/*
  What becomes of one of a turn's calls:

  - `question`: an `ask_user` within its bounds, drawn as a question the member answers
  - `run`: a call to a tool the worker runs, drawn as a call that runs
  - `refused`: a call nothing runs, answered with `reason`, drawn as a call that failed when
    `isDrawn`, or not at all for a question past its bounds, so nothing of it reaches the thread
*/
export type ConversationToolCallPlan =
  | { kind: 'question'; call: ConversationToolCall; question: ConversationQuestion }
  | { kind: 'run'; call: ConversationToolCall }
  | { kind: 'refused'; call: ConversationToolCall; reason: string; isDrawn: boolean }

type Options = {
  // How many calls the turns before it made since the run's anchor, which a resumed run shares
  // with the run it carries on
  callsBefore: number
  // The tools the worker runs
  runnerNames: string[]
}

/*
  What becomes of each of a turn's calls, from the transcript alone, so a worker taking over after a
  crash plans the same. A question past its bounds is never drawn, whatever else holds. A turn runs
  at most 10 calls, and the turns answering one member's entry 50, questions included: a call past
  either is drawn as failed and answered as not run. A call to a tool nobody runs is drawn as failed
*/
function planConversationToolCalls(
  calls: ConversationToolCall[],
  { callsBefore, runnerNames }: Options,
): ConversationToolCallPlan[] {
  return calls.map((call, index) => {
    // Checked before the limits, so a question past its bounds never reaches the thread
    const checked = call.name === ASK_USER_TOOL_NAME ? checkConversationQuestion(call.input) : null

    if (checked?.outcome === 'invalid') return { kind: 'refused', call, reason: checked.reason, isDrawn: false }

    if (index >= MAX_TOOL_CALLS_PER_TURN) {
      return refuse(
        call,
        `Not run: a turn runs at most ${MAX_TOOL_CALLS_PER_TURN} calls. Call it again if you still need it.`,
      )
    }

    if (callsBefore + index >= MAX_TOOL_CALLS_PER_RUN) {
      return refuse(
        call,
        `Not run: a response runs at most ${MAX_TOOL_CALLS_PER_RUN} calls. Answer with what you have.`,
      )
    }

    if (checked?.outcome === 'valid') return { kind: 'question', call, question: checked.question }

    if (!runnerNames.includes(call.name)) return refuse(call, `Not run: there is no tool called ${call.name}.`)

    return { kind: 'run', call }
  })
}

function refuse(call: ConversationToolCall, reason: string): ConversationToolCallPlan {
  return { kind: 'refused', call, reason, isDrawn: true }
}

export default planConversationToolCalls
