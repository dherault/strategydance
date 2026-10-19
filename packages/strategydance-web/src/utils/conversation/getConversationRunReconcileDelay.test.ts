import { describe, expect, test } from 'bun:test'

import { ConversationRunStatus } from 'strategydance-database/web'

import {
  CONVERSATION_ANSWER_RECONCILE_DELAY_MS,
  CONVERSATION_RUN_LEASE_MS,
  CONVERSATION_RUN_RECONCILE_MARGIN_MS,
} from '~constants'

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

  test('waits a whole lease from a renewal it saw, however far ahead the reader’s clock runs', () => {
    // A minute and a half ahead of the database's, which reads a lease renewed now as passed
    const ahead = NOW + 90 * 1000
    const renewed = { status: ConversationRunStatus.RUNNING, leaseExpiresAt: '2026-10-05T12:01:00.000000Z' }

    expect(getConversationRunReconcileDelay(renewed, ahead)).toBe(0)
    expect(getConversationRunReconcileDelay(renewed, ahead, { leaseMovedAt: ahead })).toBe(
      CONVERSATION_RUN_LEASE_MS + CONVERSATION_RUN_RECONCILE_MARGIN_MS,
    )
    // Ten seconds after it saw the renewal, the rest of that lease
    expect(getConversationRunReconcileDelay(renewed, ahead + 10000, { leaseMovedAt: ahead })).toBe(
      CONVERSATION_RUN_LEASE_MS + CONVERSATION_RUN_RECONCILE_MARGIN_MS - 10000,
    )
  })

  test('asks at once for a queued run whose lease was brought in, though it moved', () => {
    expect(
      getConversationRunReconcileDelay(
        { status: ConversationRunStatus.QUEUED, leaseExpiresAt: '2026-10-05T12:00:00.000000Z' },
        NOW,
        { leaseMovedAt: NOW },
      ),
    ).toBe(CONVERSATION_RUN_RECONCILE_MARGIN_MS)
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
