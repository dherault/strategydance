import { describe, expect, it } from 'bun:test'

import type { TaskLinks } from 'strategydance-core'

import findTaskLoop from './findTaskLoop'

function board(links: Record<string, string[]>) {
  return new Map<string, TaskLinks>(
    Object.entries(links).map(([id, dependencyIds]) => [id, { id, isDone: false, dependencyIds }]),
  )
}

describe('findTaskLoop', () => {
  it('finds no loop where the task is not among what the other waits on', () => {
    expect(findTaskLoop('a', 'b', board({ a: [], b: ['c'], c: [] }))).toBeNull()
  })

  it('names a loop of two, the task first', () => {
    expect(findTaskLoop('a', 'b', board({ a: [], b: ['a'] }))).toEqual(['a', 'b'])
  })

  it('names a loop of three in its order, each waiting on the next', () => {
    expect(findTaskLoop('a', 'b', board({ a: [], b: ['c'], c: ['a'] }))).toEqual(['a', 'b', 'c'])
  })

  it('takes the shortest way back, and ends on a loop the board holds already', () => {
    const links = board({ a: [], b: ['c', 'a'], c: ['d'], d: ['c'] })

    expect(findTaskLoop('a', 'b', links)).toEqual(['a', 'b'])
    expect(findTaskLoop('x', 'c', links)).toBeNull()
  })

  it('follows a loop through a thousand tasks', () => {
    const links = board(
      Object.fromEntries(Array.from({ length: 1000 }, (_, index) => [`t${index}`, index ? [`t${index - 1}`] : []])),
    )

    expect(findTaskLoop('t0', 't999', links)).toHaveLength(1000)
  })
})
