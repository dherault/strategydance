import { beforeEach, describe, expect, mock, test } from 'bun:test'

import { Status } from 'google-gax'

type CreateTaskRequest = {
  parent: string
  task: {
    name: string
    dispatchDeadline: { seconds: number }
    httpRequest: {
      httpMethod: string
      url: string
      headers: Record<string, string>
      body: string
      oidcToken: { serviceAccountEmail: string; audience: string }
    }
  }
}

// What Cloud Tasks answers each ask with, in turn: nothing for a task queued, or an error
let answers: unknown[]

const createTask = mock(async (_request: CreateTaskRequest, _options: unknown) => {
  const answer = answers.shift()

  if (answer) throw answer

  return [{}]
})

mock.module('~utils/getCloudTasksClient', () => ({ default: () => ({ createTask }) }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

const { default: queueConversationRun } = await import('./queueConversationRun')

const REFERENCE = {
  organizationId: '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f',
  userId: 'author',
  conversationId: '1a2b3c4d5e6f40718293a4b5c6d7e8f9',
  runId: '9f8e7d6c5b4a43210fedcba987654321',
}

function failure(code: number) {
  return Object.assign(new Error(`Failed with ${code}`), { code })
}

function queue() {
  return queueConversationRun(REFERENCE, { retryDelayMs: 0 })
}

function readNames() {
  return createTask.mock.calls.map(([request]) => request.task.name)
}

beforeEach(() => {
  answers = []
  createTask.mockClear()
})

describe('queueConversationRun', () => {
  test('queues a task named after the run, delivering it to the worker with a token Cloud Run checks', async () => {
    expect(await queue()).toBe('queued')

    const [request, options] = createTask.mock.calls[0] ?? []

    expect(request).toEqual({
      parent: 'projects/strategydance/locations/us-central1/queues/conversation-runs',
      task: {
        name: `projects/strategydance/locations/us-central1/queues/conversation-runs/tasks/run-${REFERENCE.runId}`,
        dispatchDeadline: { seconds: 900 },
        httpRequest: {
          httpMethod: 'POST',
          url: 'https://strategydance-worker-995028545701.us-central1.run.app/internal/conversation-runs',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
          oidcToken: {
            serviceAccountEmail: 'conversation-tasks@strategydance.iam.gserviceaccount.com',
            audience: 'https://strategydance-worker-995028545701.us-central1.run.app',
          },
        },
      },
    })
    expect(JSON.parse(Buffer.from(request?.task.httpRequest.body ?? '', 'base64').toString())).toEqual(REFERENCE)
    expect(options).toMatchObject({ retry: null })
  })

  test('sends the run’s keys alone, whatever else the reference carries', async () => {
    await queueConversationRun({ ...REFERENCE, attempts: 1 } as typeof REFERENCE, { retryDelayMs: 0 })

    const [request] = createTask.mock.calls[0] ?? []

    expect(JSON.parse(Buffer.from(request?.task.httpRequest.body ?? '', 'base64').toString())).toEqual(REFERENCE)
  })

  test('counts a task that exists already as queued', async () => {
    answers = [failure(Status.ALREADY_EXISTS)]

    expect(await queue()).toBe('queued')
    expect(createTask).toHaveBeenCalledTimes(1)
  })

  test('asks again under the same name after a failure that leaves it unclear, and a lost connection', async () => {
    answers = [failure(Status.UNAVAILABLE), new Error('Socket closed')]

    expect(await queue()).toBe('queued')
    expect(readNames()).toHaveLength(3)
    expect(new Set(readNames()).size).toBe(1)
  })

  test('counts a task that turned out to exist after an unclear failure as queued', async () => {
    answers = [failure(Status.DEADLINE_EXCEEDED), failure(Status.ALREADY_EXISTS)]

    expect(await queue()).toBe('queued')
    expect(createTask).toHaveBeenCalledTimes(2)
  })

  test('gives up after three unclear failures', async () => {
    answers = [failure(Status.UNAVAILABLE), failure(Status.DEADLINE_EXCEEDED), failure(Status.UNAVAILABLE)]

    expect(await queue()).toBe('unavailable')
    expect(createTask).toHaveBeenCalledTimes(3)
  })

  test('gives up at once on a definite refusal', async () => {
    for (const code of [
      Status.PERMISSION_DENIED,
      Status.NOT_FOUND,
      Status.INVALID_ARGUMENT,
      Status.RESOURCE_EXHAUSTED,
    ]) {
      createTask.mockClear()
      answers = [failure(code)]

      expect(await queue()).toBe('unavailable')
      expect(createTask).toHaveBeenCalledTimes(1)
    }
  })
})
