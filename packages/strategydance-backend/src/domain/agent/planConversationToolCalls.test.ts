import { describe, expect, test } from 'bun:test'

import { MAX_TOOL_CALLS_PER_RUN, MAX_TOOL_CALLS_PER_TURN } from 'strategydance-core'

import planConversationToolCalls from './planConversationToolCalls'
import type { ConversationToolCall } from './readConversationToolCalls'

const QUESTION = { prompt: 'Which channel first?', options: ['X', 'LinkedIn'], multiple: false }

function call(name: string, index: number, input: unknown = {}): ConversationToolCall {
  return { id: `toolu_${index}`, name, input, block: index }
}

describe('planConversationToolCalls', () => {
  test('asks a question, runs a known tool and refuses one nobody runs, drawn as failed', () => {
    const plans = planConversationToolCalls(
      [call('ask_user', 0, QUESTION), call('read_log', 1), call('delete_everything', 2)],
      { callsBefore: 0, runnerNames: ['read_log'] },
    )

    expect(plans.map(plan => plan.kind)).toEqual(['question', 'run', 'refused'])
    expect(plans[0]).toMatchObject({ question: { prompt: 'Which channel first?', isMultipleChoice: false } })
    expect(plans[2]).toMatchObject({ isDrawn: true, reason: 'Not run: there is no tool called delete_everything.' })
  })

  test('draws nothing of a question past its bounds', () => {
    const [plan] = planConversationToolCalls([call('ask_user', 0, { ...QUESTION, options: ['X'] })], {
      callsBefore: 0,
      runnerNames: [],
    })

    expect(plan).toMatchObject({ kind: 'refused', isDrawn: false })
  })

  test('draws nothing of a question past its bounds even past a limit, answering why it was not asked', () => {
    const [plan] = planConversationToolCalls([call('ask_user', 0, { ...QUESTION, prompt: 'Which\nchannel?' })], {
      callsBefore: MAX_TOOL_CALLS_PER_RUN,
      runnerNames: [],
    })

    expect(plan).toMatchObject({ kind: 'refused', isDrawn: false, reason: expect.stringContaining('not asked') })
  })

  test(`runs ${MAX_TOOL_CALLS_PER_TURN} calls a turn, and answers the rest as not run`, () => {
    const calls = Array.from({ length: MAX_TOOL_CALLS_PER_TURN + 2 }, (_, index) => call('read_log', index))
    const plans = planConversationToolCalls(calls, { callsBefore: 0, runnerNames: ['read_log'] })

    expect(plans.filter(plan => plan.kind === 'run')).toHaveLength(MAX_TOOL_CALLS_PER_TURN)
    expect(plans.slice(MAX_TOOL_CALLS_PER_TURN).every(plan => plan.kind === 'refused' && plan.isDrawn)).toBe(true)
  })

  test(`runs ${MAX_TOOL_CALLS_PER_RUN} calls a response, questions counted, past which a question is refused too`, () => {
    const plans = planConversationToolCalls([call('read_log', 0), call('ask_user', 1, QUESTION)], {
      callsBefore: MAX_TOOL_CALLS_PER_RUN - 1,
      runnerNames: ['read_log'],
    })

    expect(plans[0]?.kind).toBe('run')
    expect(plans[1]).toMatchObject({ kind: 'refused', isDrawn: true })
  })
})
