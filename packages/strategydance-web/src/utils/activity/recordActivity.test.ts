import { describe, expect, mock, spyOn, test } from 'bun:test'

// A localStorage for the module to keep its days in, set before it is imported, since it asks
// whether there is one when it loads
const store = new Map<string, string>()

globalThis.localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value)
  },
  removeItem: (key: string) => {
    store.delete(key)
  },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
}

// Each write's outcome in turn: an error for one the server refuses, nothing for one it takes
let failures: (Error | undefined)[] = []

const recordActivityMutation = mock(
  async (_dataConnect: unknown, _variables: { organizationId: string; date: string }) => {
    const failure = failures.shift()

    if (failure) throw failure
  },
)

mock.module('strategydance-database/web', () => ({
  CompanyAspect: {},
  TaskStatus: {},
  recordActivity: recordActivityMutation,
}))

mock.module('~data/firebase', () => ({
  authentication: { currentUser: { uid: 'alex' }, authStateReady: async () => {} },
  dataConnect: {},
}))

mock.module('~utils/date/getLocalDate', () => ({ default: () => '2026-09-29' }))

// A refusal is logged, which the test says rather than prints
const logError = spyOn(console, 'error').mockImplementation(() => {})

const { default: recordActivity } = await import('~utils/activity/recordActivity')

const pendingDays = () => JSON.parse(store.get('strategydance:pendingActivity') ?? '[]')

describe('recordActivity', () => {
  test('tries a refused day again, and forgets it once the server has it', async () => {
    failures = [new Error('Unavailable')]

    recordActivity('acme')

    expect(recordActivityMutation).toHaveBeenCalledTimes(1)
    expect(pendingDays()).toEqual([{ userId: 'alex', organizationId: 'acme', date: '2026-09-29' }])

    // The first try again waits two seconds
    await Bun.sleep(2200)

    expect(recordActivityMutation).toHaveBeenCalledTimes(2)
    expect(logError).toHaveBeenCalledTimes(1)
    expect(pendingDays()).toEqual([])
  })

  test('sends a day once', () => {
    recordActivity('acme')

    expect(recordActivityMutation).toHaveBeenCalledTimes(2)
  })

  test("sends another organization's day", async () => {
    recordActivity('globex')
    await Bun.sleep(0)

    expect(recordActivityMutation).toHaveBeenCalledTimes(3)
    expect(recordActivityMutation.mock.calls[2][1]).toEqual({ organizationId: 'globex', date: '2026-09-29' })
  })
})
