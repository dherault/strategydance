import { describe, expect, it } from 'bun:test'

import { ConversationRunStatus } from 'strategydance-database/web'

import type { ConversationRun, ConversationSubagent } from '~types'

import getConversationSubagentsSummary from '~utils/conversation/getConversationSubagentsSummary'

function subagent({
  isLive = false,
  isStopping = false,
  isReported = false,
  isDelivered = false,
}: { isLive?: boolean; isStopping?: boolean; isReported?: boolean; isDelivered?: boolean } = {}) {
  return {
    activeRunId: isLive ? 'run' : null,
    reportedAt: isReported ? '2026-10-17T12:00:00Z' : null,
    reportDeliveredAt: isDelivered ? '2026-10-17T12:01:00Z' : null,
    latestRuns: [{ stopRequestedAt: isStopping ? '2026-10-17T12:00:00Z' : null }],
  } as unknown as ConversationSubagent
}

function run(status: ConversationRunStatus) {
  return { status } as ConversationRun
}

describe('getConversationSubagentsSummary', () => {
  it('counts the subagents at work, and stops them while one is not asked to stop yet', () => {
    const subagents = [subagent({ isLive: true }), subagent({ isLive: true, isStopping: true }), subagent()]

    expect(getConversationSubagentsSummary(subagents, run(ConversationRunStatus.COMPLETED))).toEqual({
      workingCount: 2,
      isStoppable: true,
      waitingReportCount: 0,
    })
    expect(getConversationSubagentsSummary([subagent({ isLive: true, isStopping: true })], null).isStoppable).toBe(
      false,
    )
  })

  it('counts the reports waiting once the conversation ended where it reacts to none', () => {
    const subagents = [
      subagent({ isReported: true }),
      subagent({ isReported: true }),
      subagent({ isReported: true, isDelivered: true }),
      subagent({ isLive: true }),
    ]

    for (const status of [
      ConversationRunStatus.STOPPED,
      ConversationRunStatus.FAILED,
      ConversationRunStatus.REFUSED,
      ConversationRunStatus.INTERRUPTED,
    ]) {
      expect(getConversationSubagentsSummary(subagents, run(status)).waitingReportCount).toBe(2)
    }
  })

  it('says no report waits while the conversation can react, works or has not run', () => {
    const subagents = [subagent({ isReported: true })]

    for (const status of [
      ConversationRunStatus.COMPLETED,
      ConversationRunStatus.WAITING,
      ConversationRunStatus.QUEUED,
      ConversationRunStatus.RUNNING,
    ]) {
      expect(getConversationSubagentsSummary(subagents, run(status)).waitingReportCount).toBe(0)
    }

    expect(getConversationSubagentsSummary(subagents, null).waitingReportCount).toBe(0)
  })
})
