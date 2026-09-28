import { describe, expect, it } from 'bun:test'

import runInOrder from '~utils/common/runInOrder'

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

describe('runInOrder', () => {
  it('runs writes to one key in the order they were asked for', async () => {
    const order: string[] = []

    await Promise.all([
      runInOrder('row', async () => {
        await wait(20)
        order.push('delete')
      }),
      runInOrder('row', async () => {
        order.push('restore')
      }),
    ])

    expect(order).toEqual(['delete', 'restore'])
  })

  it('runs writes to different keys side by side', async () => {
    const order: string[] = []

    await Promise.all([
      runInOrder('first', async () => {
        await wait(20)
        order.push('first')
      }),
      runInOrder('second', async () => {
        order.push('second')
      }),
    ])

    expect(order).toEqual(['second', 'first'])
  })

  it('carries on past a write that fails, and still reports the failure', async () => {
    const failed = runInOrder('row', async () => {
      throw new Error('refused')
    })
    const next = runInOrder('row', async () => 'written')

    expect(failed).rejects.toThrow('refused')
    expect(await next).toBe('written')
  })

  it('waits for the rows a write depends on, without holding them up', async () => {
    const order: string[] = []

    await Promise.all([
      runInOrder('list', async () => {
        await wait(20)
        order.push('create list')
      }),
      runInOrder('task', async () => {
        order.push('add task')
      }, ['list']),
      runInOrder('list', async () => {
        order.push('rename list')
      }),
    ])

    expect(order).toEqual(['create list', 'add task', 'rename list'])
  })
})
