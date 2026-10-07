import { describe, expect, test } from 'bun:test'

import isAwaitingConversationRun from '~utils/conversation/isAwaitingConversationRun'

describe('isAwaitingConversationRun', () => {
  test('waits while the read still shows the run from before the send', () => {
    expect(isAwaitingConversationRun({ runId: 'run-2', previousRunId: 'run-1' }, { id: 'run-1' })).toBe(true)
  })

  test("waits while a draft's read still shows no run", () => {
    expect(isAwaitingConversationRun({ runId: 'run-1', previousRunId: null }, null)).toBe(true)
  })

  test('stops once the read shows the run started', () => {
    expect(isAwaitingConversationRun({ runId: 'run-2', previousRunId: 'run-1' }, { id: 'run-2' })).toBe(false)
    expect(isAwaitingConversationRun({ runId: 'run-1', previousRunId: null }, { id: 'run-1' })).toBe(false)
  })

  test('stops once the read moves past it, to a run sent after it from another tab', () => {
    expect(isAwaitingConversationRun({ runId: 'run-2', previousRunId: 'run-1' }, { id: 'run-3' })).toBe(false)
  })

  test('never waits on a retried send that answered with the run already shown', () => {
    expect(isAwaitingConversationRun({ runId: 'run-1', previousRunId: 'run-1' }, { id: 'run-1' })).toBe(false)
  })

  test('never waits without a send', () => {
    expect(isAwaitingConversationRun(null, { id: 'run-1' })).toBe(false)
    expect(isAwaitingConversationRun(null, null)).toBe(false)
  })
})
