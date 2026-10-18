import { describe, expect, it } from 'bun:test'

import { ConversationRunStatus, ConversationRunTrigger } from 'strategydance-database/web'

import type { ConversationSubagent } from '~types'

import getConversationSubagentStatus from '~utils/conversation/getConversationSubagentStatus'

function subagent(
  status: ConversationRunStatus,
  { trigger = ConversationRunTrigger.LAUNCH, stopRequestedAt = null as string | null } = {},
) {
  const isLive = [ConversationRunStatus.QUEUED, ConversationRunStatus.RUNNING, ConversationRunStatus.PENDING].includes(
    status,
  )

  return {
    id: 'subagent',
    title: 'Research the competitors',
    activeRunId: isLive ? 'run' : null,
    latestRuns: [{ id: 'run', number: 1, status, trigger, stopRequestedAt }],
  } as unknown as ConversationSubagent
}

describe('getConversationSubagentStatus', () => {
  it('says a subagent waits for a slot, is queued for its first run, or works', () => {
    expect(getConversationSubagentStatus(subagent(ConversationRunStatus.PENDING))).toBe('waitingForSlot')
    expect(getConversationSubagentStatus(subagent(ConversationRunStatus.QUEUED))).toBe('queued')
    expect(getConversationSubagentStatus(subagent(ConversationRunStatus.RUNNING))).toBe('working')
  })

  it('says a subagent carrying on in its next run works, queued as that run is', () => {
    expect(
      getConversationSubagentStatus(
        subagent(ConversationRunStatus.QUEUED, { trigger: ConversationRunTrigger.CONTINUE }),
      ),
    ).toBe('working')
  })

  it('says a busy subagent asked to stop is stopping, whatever its run', () => {
    for (const status of [ConversationRunStatus.PENDING, ConversationRunStatus.QUEUED, ConversationRunStatus.RUNNING]) {
      expect(getConversationSubagentStatus(subagent(status, { stopRequestedAt: '2026-10-17T12:00:00Z' }))).toBe(
        'stopping',
      )
    }
  })

  it('says how a subagent ended, reported when it completed', () => {
    expect(getConversationSubagentStatus(subagent(ConversationRunStatus.COMPLETED))).toBe('reported')
    expect(
      getConversationSubagentStatus(
        subagent(ConversationRunStatus.STOPPED, { stopRequestedAt: '2026-10-17T12:00:00Z' }),
      ),
    ).toBe('stopped')
    expect(getConversationSubagentStatus(subagent(ConversationRunStatus.FAILED))).toBe('failed')
    expect(getConversationSubagentStatus(subagent(ConversationRunStatus.REFUSED))).toBe('failed')
    expect(getConversationSubagentStatus(subagent(ConversationRunStatus.INTERRUPTED))).toBe('interrupted')
  })

  it('takes a subagent with no run read yet as queued', () => {
    expect(getConversationSubagentStatus({ ...subagent(ConversationRunStatus.QUEUED), latestRuns: [] })).toBe('queued')
  })
})
