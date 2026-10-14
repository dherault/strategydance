import { describe, expect, test } from 'bun:test'

import getConversationThinkingStart from '~utils/conversation/getConversationThinkingStart'

const SENT_AT = '2026-10-14T10:00:00.000Z'
const CREATED_AT = '2026-10-14T10:00:02.500Z'

describe('getConversationThinkingStart', () => {
  test('counts from when the message was sent while its send goes', () => {
    expect(
      getConversationThinkingStart({
        run: null,
        isWorking: false,
        sendingMessage: { sentAt: SENT_AT },
        startedRun: null,
        isAwaiting: false,
      }),
    ).toBe(SENT_AT)
  })

  test('counts from the same moment once the backend answered, until the run is read', () => {
    expect(
      getConversationThinkingStart({
        run: null,
        isWorking: false,
        sendingMessage: null,
        startedRun: { runId: 'run-1', startedAt: SENT_AT },
        isAwaiting: true,
      }),
    ).toBe(SENT_AT)
  })

  test('counts on from the same moment while the run the send started goes', () => {
    expect(
      getConversationThinkingStart({
        run: { id: 'run-1', createdAt: CREATED_AT },
        isWorking: true,
        sendingMessage: null,
        startedRun: { runId: 'run-1', startedAt: SENT_AT },
        isAwaiting: false,
      }),
    ).toBe(SENT_AT)
  })

  test('counts from when it was queued for any other run going', () => {
    expect(
      getConversationThinkingStart({
        run: { id: 'run-2', createdAt: CREATED_AT },
        isWorking: true,
        sendingMessage: null,
        startedRun: { runId: 'run-1', startedAt: SENT_AT },
        isAwaiting: false,
      }),
    ).toBe(CREATED_AT)
    expect(
      getConversationThinkingStart({
        run: { id: 'run-1', createdAt: CREATED_AT },
        isWorking: true,
        sendingMessage: null,
        startedRun: { runId: 'run-1' },
        isAwaiting: false,
      }),
    ).toBe(CREATED_AT)
  })

  test('says nothing for a run started otherwise, before it is read', () => {
    expect(
      getConversationThinkingStart({
        run: null,
        isWorking: false,
        sendingMessage: null,
        startedRun: { runId: 'run-1' },
        isAwaiting: true,
      }),
    ).toBe(null)
  })
})
