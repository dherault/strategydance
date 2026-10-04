import { describe, expect, it } from 'bun:test'

import { ConversationRunStatus } from 'strategydance-database/web'

import type { ConversationRun } from '~types'

import isOlderConversationRun from '~utils/conversation/isOlderConversationRun'

function run(number: number, status: ConversationRunStatus) {
  return { id: `run-${number}`, number, status } as ConversationRun
}

describe('isOlderConversationRun', () => {
  it('takes an earlier run as older, and a later one as newer', () => {
    expect(isOlderConversationRun(run(2, ConversationRunStatus.QUEUED), run(1, ConversationRunStatus.RUNNING))).toBe(
      true,
    )
    expect(isOlderConversationRun(run(1, ConversationRunStatus.COMPLETED), run(2, ConversationRunStatus.QUEUED))).toBe(
      false,
    )
  })

  it('takes the same run at a status it has moved past as older', () => {
    expect(isOlderConversationRun(run(1, ConversationRunStatus.COMPLETED), run(1, ConversationRunStatus.RUNNING))).toBe(
      true,
    )
    expect(isOlderConversationRun(run(1, ConversationRunStatus.CONTINUED), run(1, ConversationRunStatus.WAITING))).toBe(
      true,
    )
  })

  it('takes the same run at a status further on, or the same one, as newer', () => {
    expect(isOlderConversationRun(run(1, ConversationRunStatus.QUEUED), run(1, ConversationRunStatus.RUNNING))).toBe(
      false,
    )
    expect(isOlderConversationRun(run(1, ConversationRunStatus.RUNNING), run(1, ConversationRunStatus.RUNNING))).toBe(
      false,
    )
  })

  it('never takes a run gone as older, nor one coming back', () => {
    expect(isOlderConversationRun(run(1, ConversationRunStatus.RUNNING), undefined)).toBe(false)
    expect(isOlderConversationRun(undefined, run(1, ConversationRunStatus.RUNNING))).toBe(false)
  })
})
