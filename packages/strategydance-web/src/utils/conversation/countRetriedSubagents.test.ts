import { describe, expect, it } from 'bun:test'

import type { ConversationSubagent } from '~types'

import countRetriedSubagents from '~utils/conversation/countRetriedSubagents'

function subagent(anchor: number | null, isLive = false) {
  return { launchAnchorPosition: anchor, activeRunId: isLive ? 'run' : null } as unknown as ConversationSubagent
}

describe('countRetriedSubagents', () => {
  it('counts the subagents launched on the retried run’s anchor, and those still busy among them', () => {
    const subagents = [subagent(4), subagent(4, true), subagent(4, true), subagent(0, true), subagent(null)]

    expect(countRetriedSubagents(subagents, 4)).toEqual({ total: 3, working: 2 })
  })

  it('counts none when the run launched none', () => {
    expect(countRetriedSubagents([subagent(0)], 4)).toEqual({ total: 0, working: 0 })
    expect(countRetriedSubagents([], 0)).toEqual({ total: 0, working: 0 })
  })
})
