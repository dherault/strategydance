import { describe, expect, it } from 'bun:test'

import createTaskQueue from '~utils/common/createTaskQueue'

// A task the test ends by hand, which says when it started and whether it was aborted
function createTask(log: string[], name: string) {
  let end = () => {}
  let signal: AbortSignal | null = null

  return {
    get isAborted() {
      return !!signal?.aborted
    },
    end: () => end(),
    task: (given: AbortSignal) =>
      new Promise<void>(resolve => {
        signal = given
        log.push(name)
        end = resolve
      }),
  }
}

async function settle() {
  for (let round = 0; round < 5; round++) await Promise.resolve()
}

describe('createTaskQueue', () => {
  it('runs a few tasks at a time, the rest in the order they were asked for', async () => {
    const log: string[] = []
    const queue = createTaskQueue(2)
    const [first, second, third, fourth] = ['first', 'second', 'third', 'fourth'].map(name => createTask(log, name))

    queue.run('a', first!.task)
    queue.run('b', second!.task)
    queue.run('c', third!.task)
    queue.run('d', fourth!.task)

    expect(log).toEqual(['first', 'second'])

    second!.end()
    await settle()

    expect(log).toEqual(['first', 'second', 'third'])

    first!.end()
    await settle()

    expect(log).toEqual(['first', 'second', 'third', 'fourth'])
  })

  it('takes a waiting task out of the line, and aborts one under way, which keeps its place until it settles', async () => {
    const log: string[] = []
    const queue = createTaskQueue(1)
    const [first, second, third] = ['first', 'second', 'third'].map(name => createTask(log, name))

    queue.run('a', first!.task)
    queue.run('b', second!.task)
    queue.run('c', third!.task)
    queue.abort('b')

    expect(log).toEqual(['first'])

    queue.abort('a')
    await settle()

    expect(first!.isAborted).toBe(true)
    expect(log).toEqual(['first'])

    first!.end()
    await settle()

    expect(log).toEqual(['first', 'third'])
  })

  it('makes room after a task that fails', async () => {
    const log: string[] = []
    const queue = createTaskQueue(1)
    const second = createTask(log, 'second')

    queue.run('a', async () => {
      log.push('first')

      throw new Error('Failed')
    })
    queue.run('b', second.task)
    await settle()

    expect(log).toEqual(['first', 'second'])
  })

  it('aborts the task a key ran when it runs another, and runs the other once there is room', async () => {
    const log: string[] = []
    const queue = createTaskQueue(1)
    const [first, again] = ['first', 'again'].map(name => createTask(log, name))

    queue.run('a', first!.task)
    queue.run('a', again!.task)

    expect(first!.isAborted).toBe(true)
    expect(log).toEqual(['first'])

    // The first ending late lets the second run, and aborts nothing of it
    first!.end()
    await settle()

    expect(log).toEqual(['first', 'again'])
    expect(again!.isAborted).toBe(false)
  })

  it('takes every waiting task out of the line, and aborts those under way, at once', async () => {
    const log: string[] = []
    const queue = createTaskQueue(1)
    const [first, second] = ['first', 'second'].map(name => createTask(log, name))

    queue.run('a', first!.task)
    queue.run('b', second!.task)
    queue.abortAll()
    await settle()

    expect(first!.isAborted).toBe(true)

    first!.end()
    await settle()

    expect(log).toEqual(['first'])
  })
})
