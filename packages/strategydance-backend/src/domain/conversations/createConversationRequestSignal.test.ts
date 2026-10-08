import { describe, expect, mock, test } from 'bun:test'

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

const { default: createConversationRequestSignal } = await import('./createConversationRequestSignal')

const NEVER_STOPPED = { isStopRequested: async () => false, stopCheckIntervalMs: 60000 }

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

describe('createConversationRequestSignal', () => {
  test('aborts with the run’s own signal, saying no reason of its own', () => {
    const run = new AbortController()
    const request = createConversationRequestSignal({
      signal: run.signal,
      deadline: Date.now() + 60000,
      ...NEVER_STOPPED,
    })

    run.abort(new Error('Lost'))

    expect(request.signal.aborted).toBe(true)
    expect(request.readReason()).toBeNull()

    request.dispose()
  })

  test('starts aborted when the run’s signal already is', () => {
    const run = new AbortController()

    run.abort()

    expect(
      createConversationRequestSignal({ signal: run.signal, deadline: Date.now() + 60000, ...NEVER_STOPPED }).signal
        .aborted,
    ).toBe(true)
  })

  test('cuts the request at its deadline, saying so', async () => {
    const run = new AbortController()
    const request = createConversationRequestSignal({ signal: run.signal, deadline: Date.now() + 10, ...NEVER_STOPPED })

    await wait(30)

    expect(request.signal.aborted).toBe(true)
    expect(request.readReason()).toBe('deadline')
    expect(run.signal.aborted).toBe(false)
  })

  test('stops the request once its member asks, saying so, and keeps reading after a read that failed', async () => {
    const run = new AbortController()
    const answers = [() => Promise.reject(new Error('Unavailable')), async () => false, async () => true]
    const request = createConversationRequestSignal({
      signal: run.signal,
      deadline: Date.now() + 60000,
      isStopRequested: () => (answers.shift() ?? (async () => true))(),
      stopCheckIntervalMs: 5,
    })

    await wait(50)

    expect(request.signal.aborted).toBe(true)
    expect(request.readReason()).toBe('stopped')

    request.dispose()
  })

  test('cuts nothing once disposed', async () => {
    const run = new AbortController()
    const request = createConversationRequestSignal({ signal: run.signal, deadline: Date.now() + 10, ...NEVER_STOPPED })

    request.dispose()
    run.abort()
    await wait(30)

    expect(request.signal.aborted).toBe(false)
  })
})
