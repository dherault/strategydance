import { afterEach, beforeEach, describe, expect, mock, setSystemTime, test } from 'bun:test'

const written: string[] = []

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => ({
  recordAgentConnectionUse: async (_dataConnect: unknown, { id }: { id: string }) => {
    written.push(id)

    return { data: { agentConnection_updateMany: 1 } }
  },
}))

const { default: createAgentConnectionUseRecorder } = await import('./createAgentConnectionUseRecorder')

beforeEach(() => {
  written.length = 0
})

afterEach(() => {
  setSystemTime()
})

describe('createAgentConnectionUseRecorder', () => {
  test('writes each connection once a minute, from what it remembers', async () => {
    const recordUse = createAgentConnectionUseRecorder()

    await recordUse('a', 'member')
    await recordUse('a', 'member')

    expect(written).toEqual(['a'])

    setSystemTime(Date.now() + 61 * 1000)
    await recordUse('a', 'member')

    expect(written).toEqual(['a', 'a'])
  })

  test('remembers no more connections than it may, forgetting the one it wrote longest ago', async () => {
    const recordUse = createAgentConnectionUseRecorder({ maxRemembered: 2 })

    await recordUse('a', 'member')
    await recordUse('b', 'member')
    await recordUse('c', 'member')
    written.length = 0

    // `a` went to make room for `c`, so it is asked of the database again, which holds the minute
    await recordUse('b', 'member')
    await recordUse('c', 'member')
    await recordUse('a', 'member')

    expect(written).toEqual(['a'])
  })

  test('counts a connection written again as the newest', async () => {
    const recordUse = createAgentConnectionUseRecorder({ maxRemembered: 2 })

    await recordUse('a', 'member')
    await recordUse('b', 'member')
    setSystemTime(Date.now() + 61 * 1000)
    await recordUse('a', 'member')
    await recordUse('c', 'member')
    written.length = 0

    await recordUse('a', 'member')
    await recordUse('b', 'member')

    expect(written).toEqual(['b'])
  })
})
