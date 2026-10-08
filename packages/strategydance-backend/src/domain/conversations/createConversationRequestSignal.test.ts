import { describe, expect, test } from 'bun:test'

import createConversationRequestSignal from './createConversationRequestSignal'

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

describe('createConversationRequestSignal', () => {
  test('aborts with the run’s own signal, saying no reason of its own', () => {
    const run = new AbortController()
    const request = createConversationRequestSignal({ signal: run.signal, deadline: Date.now() + 60000 })

    run.abort(new Error('Lost'))

    expect(request.signal.aborted).toBe(true)
    expect(request.readReason()).toBeNull()

    request.dispose()
  })

  test('starts aborted when the run’s signal already is', () => {
    const run = new AbortController()

    run.abort()

    expect(createConversationRequestSignal({ signal: run.signal, deadline: Date.now() + 60000 }).signal.aborted).toBe(
      true,
    )
  })

  test('cuts the request at its deadline, saying so', async () => {
    const run = new AbortController()
    const request = createConversationRequestSignal({ signal: run.signal, deadline: Date.now() + 10 })

    await wait(30)

    expect(request.signal.aborted).toBe(true)
    expect(request.readReason()).toBe('deadline')
    expect(run.signal.aborted).toBe(false)
  })

  test('cuts nothing once disposed', async () => {
    const run = new AbortController()
    const request = createConversationRequestSignal({ signal: run.signal, deadline: Date.now() + 10 })

    request.dispose()
    run.abort()
    await wait(30)

    expect(request.signal.aborted).toBe(false)
  })
})
