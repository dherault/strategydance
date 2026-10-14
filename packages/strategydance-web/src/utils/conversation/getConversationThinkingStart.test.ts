import { describe, expect, test } from 'bun:test'

import getConversationThinkingStart from '~utils/conversation/getConversationThinkingStart'

const SENT_AT = '2026-10-14T10:00:00.000Z'
const CREATED_AT = '2026-10-14T10:00:00.400Z'

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
        startedRun: { startedAt: SENT_AT },
        isAwaiting: true,
      }),
    ).toBe(SENT_AT)
  })

  test('counts from the run once it is read going', () => {
    expect(
      getConversationThinkingStart({
        run: { createdAt: CREATED_AT },
        isWorking: true,
        sendingMessage: null,
        startedRun: { startedAt: SENT_AT },
        isAwaiting: false,
      }),
    ).toBe(CREATED_AT)
  })

  test('says nothing for a run started otherwise, or a start the read has moved past', () => {
    expect(
      getConversationThinkingStart({
        run: null,
        isWorking: false,
        sendingMessage: null,
        startedRun: {},
        isAwaiting: true,
      }),
    ).toBe(null)
    expect(
      getConversationThinkingStart({
        run: { createdAt: CREATED_AT },
        isWorking: false,
        sendingMessage: null,
        startedRun: { startedAt: SENT_AT },
        isAwaiting: false,
      }),
    ).toBe(null)
  })
})
