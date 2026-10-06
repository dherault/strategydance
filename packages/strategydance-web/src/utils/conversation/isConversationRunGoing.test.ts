import { describe, expect, it } from 'bun:test'

import { ConversationRunStatus } from 'strategydance-database/web'

import isConversationRunGoing from '~utils/conversation/isConversationRunGoing'

describe('isConversationRunGoing', () => {
  it('takes a queued and a running run as going', () => {
    expect(isConversationRunGoing({ status: ConversationRunStatus.QUEUED })).toBe(true)
    expect(isConversationRunGoing({ status: ConversationRunStatus.RUNNING })).toBe(true)
  })

  it('takes every other status as ended', () => {
    const ended = Object.values(ConversationRunStatus).filter(
      status => status !== ConversationRunStatus.QUEUED && status !== ConversationRunStatus.RUNNING,
    )

    expect(ended.length).toBeGreaterThan(0)

    for (const status of ended) expect(isConversationRunGoing({ status })).toBe(false)
  })

  it('takes no run as nothing going', () => {
    expect(isConversationRunGoing(null)).toBe(false)
  })
})
