import { describe, expect, test } from 'bun:test'

import { ConversationRunStatus } from 'strategydance-database/web'

import { CONVERSATION_ANSWER_RECONCILE_DELAY_MS, CONVERSATION_RUN_RECONCILE_MARGIN_MS } from '~constants'

import getConversationRunReconcileDelay from './getConversationRunReconcileDelay'

const NOW = Date.parse('2026-10-05T12:00:00.000Z')

describe('getConversationRunReconcileDelay', () => {
  test('waits for a queued or going run’s lease to pass, and a margin after', () => {
    for (const status of [ConversationRunStatus.QUEUED, ConversationRunStatus.RUNNING]) {
      expect(getConversationRunReconcileDelay({ status, leaseExpiresAt: '2026-10-05T12:00:30.000000Z' }, NOW)).toBe(
        30000 + CONVERSATION_RUN_RECONCILE_MARGIN_MS,
      )
    }
  })

  test('asks at once for a run long past its lease', () => {
    expect(
      getConversationRunReconcileDelay(
        { status: ConversationRunStatus.RUNNING, leaseExpiresAt: '2026-10-05T11:50:00.000000Z' },
        NOW,
      ),
    ).toBe(0)
  })

  test('reconciles nothing for a run that has ended, has no lease, or is not there', () => {
    expect(
      getConversationRunReconcileDelay({ status: ConversationRunStatus.COMPLETED, leaseExpiresAt: null }, NOW),
    ).toBe(null)
    expect(
      getConversationRunReconcileDelay(
        { status: ConversationRunStatus.INTERRUPTED, leaseExpiresAt: '2026-10-05T11:50:00.000000Z' },
        NOW,
      ),
    ).toBe(null)
    expect(getConversationRunReconcileDelay({ status: ConversationRunStatus.QUEUED, leaseExpiresAt: null }, NOW)).toBe(
      null,
    )
    expect(getConversationRunReconcileDelay(null, NOW)).toBe(null)
  })

  test('asks a few seconds in for a run waiting on questions all answered, and never while one waits', () => {
    const waiting = { status: ConversationRunStatus.WAITING, leaseExpiresAt: null }

    expect(getConversationRunReconcileDelay(waiting, NOW, { isEveryQuestionAnswered: true })).toBe(
      CONVERSATION_ANSWER_RECONCILE_DELAY_MS,
    )
    expect(getConversationRunReconcileDelay(waiting, NOW, { isEveryQuestionAnswered: false })).toBe(null)
    expect(getConversationRunReconcileDelay(waiting, NOW)).toBe(null)
  })
})
