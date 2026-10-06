import { beforeEach, describe, expect, mock, test } from 'bun:test'

// What each renewal wrote, its step or null for none, and how many runs it renewed
let renewals: (string | null)[]
let renewedCount: number

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-database/backend', () => ({
  renewConversationRunLease: async (_dataConnect: unknown, { step }: { step?: string }) => {
    renewals.push(step ?? null)

    return { data: { conversationRun_updateMany: renewedCount } }
  },
}))

const { default: createConversationRunLease } = await import('./createConversationRunLease')

const fence = {
  organizationId: 'organization',
  userId: 'author',
  conversationId: 'conversation',
  runId: 'run',
  attempts: 1,
  membershipCreatedAt: '2026-10-05T12:00:00.000000Z',
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

beforeEach(() => {
  renewals = []
  renewedCount = 1
})

describe('createConversationRunLease', () => {
  test('renews the lease while the worker writes nothing else, until it stops', async () => {
    const lease = createConversationRunLease({ fence, onLost: () => {}, renewalIntervalMs: 10 })

    await wait(100)
    await lease.stop()

    const count = renewals.length

    expect(count).toBeGreaterThanOrEqual(3)

    await wait(30)

    expect(renewals.length).toBe(count)
  })

  test('writes the latest progress line, at most once an interval', async () => {
    const lease = createConversationRunLease({
      fence,
      onLost: () => {},
      renewalIntervalMs: 10000,
      stepIntervalMs: 40,
    })

    lease.setStep('Reading your message')
    lease.setStep('Thinking it over')
    await wait(5)
    lease.setStep('Weighing what to say')
    lease.setStep('Writing a reply')

    expect(renewals).toEqual(['Thinking it over'])

    await wait(60)
    await lease.stop()

    expect(renewals).toEqual(['Thinking it over', 'Writing a reply'])
  })

  test('says once that the run is lost when a renewal finds it no longer this worker’s, and renews no more', async () => {
    const onLost = mock(() => {})

    renewedCount = 0

    const lease = createConversationRunLease({ fence, onLost, renewalIntervalMs: 10 })

    await wait(45)
    await lease.stop()

    expect(onLost).toHaveBeenCalledTimes(1)
    expect(renewals).toHaveLength(1)
  })

  test('runs its writes one after the other, and stops once they are done', async () => {
    const lease = createConversationRunLease({ fence, onLost: () => {}, renewalIntervalMs: 10000 })
    const order: string[] = []

    const first = lease.write(async () => {
      await wait(20)
      order.push('first')
    })
    const second = lease.write(async () => {
      order.push('second')
    })

    await lease.stop()

    expect(order).toEqual(['first', 'second'])

    await Promise.all([first, second])
  })

  test('hands a failed write back to the worker and carries on with the next', async () => {
    const lease = createConversationRunLease({ fence, onLost: () => {}, renewalIntervalMs: 10000 })

    await expect(lease.write(async () => Promise.reject(new Error('Refused')))).rejects.toThrow('Refused')
    expect(await lease.write(async () => 'written')).toBe('written')

    await lease.stop()
  })
})
