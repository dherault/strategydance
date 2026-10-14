import { describe, expect, test } from 'bun:test'

import getConversationSendStartedRun from '~utils/conversation/getConversationSendStartedRun'
import isAwaitingConversationRun from '~utils/conversation/isAwaitingConversationRun'

describe('getConversationSendStartedRun', () => {
  test("records a first send's run", () => {
    expect(getConversationSendStartedRun({ runId: 'run-2', previousRunId: 'run-1' })).toEqual({
      runId: 'run-2',
      previousRunId: 'run-1',
    })
    expect(getConversationSendStartedRun({ runId: 'run-1', previousRunId: null })).toEqual({
      runId: 'run-1',
      previousRunId: null,
    })
  })

  test('records the run of a message sent again while the read shows what it did at the first send', () => {
    expect(
      getConversationSendStartedRun({ runId: 'run-2', previousRunId: 'run-1', firstPreviousRunId: 'run-1' }),
    ).toEqual({ runId: 'run-2', previousRunId: 'run-1' })
    expect(getConversationSendStartedRun({ runId: 'run-1', previousRunId: null, firstPreviousRunId: null })).toEqual({
      runId: 'run-1',
      previousRunId: null,
    })
  })

  test('records nothing for a message sent again once the read has moved on, as the run may be older', () => {
    // The first send started run-2 and lost its answer, and another tab started run-3 since
    expect(getConversationSendStartedRun({ runId: 'run-2', previousRunId: 'run-3', firstPreviousRunId: 'run-1' })).toBe(
      null,
    )
  })

  test('waits on nothing when a message sent again is answered with the run the read already shows', () => {
    const started = getConversationSendStartedRun({
      runId: 'run-2',
      previousRunId: 'run-1',
      firstPreviousRunId: 'run-1',
    })

    // The read has caught up with the run the first send started, before the answer came
    expect(isAwaitingConversationRun(started, { id: 'run-2' })).toBe(false)
  })
})
