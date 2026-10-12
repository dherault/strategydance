import { describe, expect, it } from 'bun:test'

import createConcurrencyLimit from './createConcurrencyLimit'

function createGate() {
  let open = () => {}
  const opened = new Promise<void>(resolve => {
    open = resolve
  })

  return { open, opened }
}

describe('createConcurrencyLimit', () => {
  it('runs at most as many tasks at once as its limit, the next in the order they came', async () => {
    const run = createConcurrencyLimit(2)
    const gates = [createGate(), createGate(), createGate(), createGate()]
    const started: number[] = []
    let running = 0
    let most = 0

    const tasks = gates.map((gate, index) =>
      run(async () => {
        started.push(index)
        running += 1
        most = Math.max(most, running)

        await gate.opened

        running -= 1

        return index
      }),
    )

    await Bun.sleep(0)

    expect(started).toEqual([0, 1])

    gates[1]?.open()
    await Bun.sleep(0)

    expect(started).toEqual([0, 1, 2])

    for (const gate of gates) gate.open()

    expect(await Promise.all(tasks)).toEqual([0, 1, 2, 3])
    expect(most).toBe(2)
  })

  it('frees the place of a task that fails', async () => {
    const run = createConcurrencyLimit(1)

    await expect(run(async () => Promise.reject(new Error('Failed')))).rejects.toThrow('Failed')

    expect(await run(async () => 'next')).toBe('next')
  })
})
