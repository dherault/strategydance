import { describe, expect, it } from 'bun:test'

import { ConversationRunStatus } from 'strategydance-database/web'

import type { ConversationSubagent } from '~types'

import { CONVERSATION_REACTION_RECONCILE_DELAY_MS, CONVERSATION_SUBAGENTS_RECONCILE_INTERVAL_MS } from '~constants'

import getConversationSubagentsReconcileDelay from '~utils/conversation/getConversationSubagentsReconcileDelay'

function subagent(
  anchor: number,
  { isLive = false, isReported = false, isDelivered = false } = {},
): ConversationSubagent {
  return {
    launchAnchorPosition: anchor,
    activeRunId: isLive ? 'run' : null,
    reportedAt: isReported ? '2026-10-17T12:00:00Z' : null,
    reportDeliveredAt: isDelivered ? '2026-10-17T12:01:00Z' : null,
  } as unknown as ConversationSubagent
}

const IDLE = { isFull: false, activeRunId: null, isAwaitingAnswer: false }
const COMPLETED = { status: ConversationRunStatus.COMPLETED }

describe('getConversationSubagentsReconcileDelay', () => {
  it('asks soon once a batch has reported whole with a report not delivered, while the conversation can react', () => {
    const subagents = [subagent(0, { isReported: true }), subagent(0, { isReported: true, isDelivered: true })]

    expect(getConversationSubagentsReconcileDelay(subagents, IDLE, COMPLETED)).toBe(
      CONVERSATION_REACTION_RECONCILE_DELAY_MS,
    )
  })

  it('asks soon for a whole batch while another still works', () => {
    const subagents = [subagent(0, { isReported: true }), subagent(4, { isLive: true })]

    expect(getConversationSubagentsReconcileDelay(subagents, IDLE, COMPLETED)).toBe(
      CONVERSATION_REACTION_RECONCILE_DELAY_MS,
    )
  })

  it('asks every two minutes while a subagent works, its batch not whole yet', () => {
    const subagents = [subagent(0, { isReported: true }), subagent(0, { isLive: true })]

    expect(getConversationSubagentsReconcileDelay(subagents, IDLE, COMPLETED)).toBe(
      CONVERSATION_SUBAGENTS_RECONCILE_INTERVAL_MS,
    )
  })

  it('leaves a reaction to a conversation that is busy, waits, is full or did not complete', () => {
    const subagents = [subagent(0, { isReported: true })]

    expect(getConversationSubagentsReconcileDelay(subagents, { ...IDLE, activeRunId: 'run' }, COMPLETED)).toBeNull()
    expect(getConversationSubagentsReconcileDelay(subagents, { ...IDLE, isAwaitingAnswer: true }, COMPLETED)).toBeNull()
    expect(getConversationSubagentsReconcileDelay(subagents, { ...IDLE, isFull: true }, COMPLETED)).toBeNull()
    expect(
      getConversationSubagentsReconcileDelay(subagents, IDLE, { status: ConversationRunStatus.STOPPED }),
    ).toBeNull()
    expect(getConversationSubagentsReconcileDelay(subagents, IDLE, null)).toBeNull()
  })

  it('asks nothing once every report is delivered and nothing works', () => {
    const subagents = [subagent(0, { isReported: true, isDelivered: true })]

    expect(getConversationSubagentsReconcileDelay(subagents, IDLE, COMPLETED)).toBeNull()
    expect(getConversationSubagentsReconcileDelay([], IDLE, COMPLETED)).toBeNull()
  })
})
