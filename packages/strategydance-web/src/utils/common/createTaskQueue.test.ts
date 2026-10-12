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

  it('takes a waiting task out of the line, and aborts one under way, making room at once', async () => {
    const log: string[] = []
    const queue = createTaskQueue(1)
    const [first, second, third] = ['first', 'second', 'third'].map(name => createTask(log, name))

    queue.run('a', first!.task)
    queue.run('b', second!.task)
    queue.run('c', third!.task)
    queue.abort('b')

    expect(log).toEqual(['first'])

    queue.abort('a')

    expect(first!.isAborted).toBe(true)
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

  it('aborts the task a key ran when it runs another', async () => {
    const log: string[] = []
    const queue = createTaskQueue(2)
    const [first, again] = ['first', 'again'].map(name => createTask(log, name))

    queue.run('a', first!.task)
    queue.run('a', again!.task)

    expect(first!.isAborted).toBe(true)
    expect(log).toEqual(['first', 'again'])

    // The first ending late takes no room from the second
    first!.end()
    await settle()

    expect(again!.isAborted).toBe(false)
  })
})
