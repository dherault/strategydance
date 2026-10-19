import { describe, expect, mock, test } from 'bun:test'

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

const { default: runSweepSteps } = await import('./runSweepSteps')

describe('runSweepSteps', () => {
  test('runs every step in order, past one that throws, and names those that failed', async () => {
    const ran: string[] = []

    const failed = await runSweepSteps({
      first: async () => {
        ran.push('first')
      },
      second: async () => {
        ran.push('second')

        throw new Error('The Files API is down')
      },
      third: async () => {
        ran.push('third')
      },
    })

    expect(ran).toEqual(['first', 'second', 'third'])
    expect(failed).toEqual(['second'])
  })
})
