import { describe, expect, it } from 'bun:test'

import type { ConversationSubagent } from '~types'

import findConversationSubagent from '~utils/conversation/findConversationSubagent'

const SUBAGENTS = [
  { id: 'scripted', launchToolUseId: null },
  { id: 'research', launchToolUseId: 'toolu_research' },
  { id: 'pricing', launchToolUseId: 'toolu_pricing' },
] as unknown as ConversationSubagent[]

describe('findConversationSubagent', () => {
  it('finds the subagent a call launched by the call’s id', () => {
    expect(findConversationSubagent(SUBAGENTS, 'toolu_pricing')?.id).toBe('pricing')
  })

  it('finds none for a call whose body is not read, nor for a launch that launched nothing', () => {
    expect(findConversationSubagent(SUBAGENTS, undefined)).toBeUndefined()
    expect(findConversationSubagent(SUBAGENTS, null)).toBeUndefined()
    expect(findConversationSubagent(SUBAGENTS, 'toolu_refused')).toBeUndefined()
  })
})
