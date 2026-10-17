import { beforeEach, describe, expect, mock, test } from 'bun:test'

import { Status } from 'google-gax'

// What Cloud Tasks answers the lookup with: nothing for a task it holds, or an error
let answer: unknown

const getTask = mock(async (_request: { name: string }, _options: unknown) => {
  if (answer) throw answer

  return [{}]
})

mock.module('~utils/getCloudTasksClient', () => ({ default: () => ({ getTask }) }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

const { default: findConversationRunTask } = await import('./findConversationRunTask')

const RUN_ID = '9f8e7d6c5b4a43210fedcba987654321'

beforeEach(() => {
  answer = null
  getTask.mockClear()
})

describe('findConversationRunTask', () => {
  test('answers queued for a task Cloud Tasks holds, looked up by the run’s task name', async () => {
    expect(await findConversationRunTask(RUN_ID, 'conversation-runs')).toBe('queued')
    expect(getTask.mock.calls[0]?.[0]).toEqual({
      name: `projects/strategydance/locations/us-central1/queues/conversation-runs/tasks/run-${RUN_ID}`,
    })
  })

  test('looks a subagent’s run up on the subagents’ own queue', async () => {
    expect(await findConversationRunTask(RUN_ID, 'subagent-runs')).toBe('queued')
    expect(getTask.mock.calls[0]?.[0]).toEqual({
      name: `projects/strategydance/locations/us-central1/queues/subagent-runs/tasks/run-${RUN_ID}`,
    })
  })

  test('answers gone for a task Cloud Tasks does not hold', async () => {
    answer = Object.assign(new Error('Not found'), { code: Status.NOT_FOUND })

    expect(await findConversationRunTask(RUN_ID, 'conversation-runs')).toBe('gone')
  })

  test('answers unknown when Cloud Tasks could not say', async () => {
    for (const error of [
      Object.assign(new Error('Unavailable'), { code: Status.UNAVAILABLE }),
      Object.assign(new Error('Denied'), { code: Status.PERMISSION_DENIED }),
      new Error('Socket closed'),
    ]) {
      answer = error

      expect(await findConversationRunTask(RUN_ID, 'conversation-runs')).toBe('unknown')
    }
  })
})
