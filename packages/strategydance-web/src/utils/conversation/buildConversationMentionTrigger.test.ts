import { describe, expect, it } from 'bun:test'

import buildConversationMentionTrigger from '~utils/conversation/buildConversationMentionTrigger'

describe('buildConversationMentionTrigger', () => {
  it('writes an `@` alone at the start and after a space', () => {
    expect(buildConversationMentionTrigger('', 0, 0)).toEqual({ start: 0, end: 0, insert: '@' })
    expect(buildConversationMentionTrigger('Hi ', 3, 3)).toEqual({ start: 3, end: 3, insert: '@' })
    expect(buildConversationMentionTrigger('Hi\n', 3, 3)).toEqual({ start: 3, end: 3, insert: '@' })
  })

  it('writes a space before it after a word', () => {
    expect(buildConversationMentionTrigger('Hi', 2, 2)).toEqual({ start: 2, end: 2, insert: ' @' })
  })

  it('writes it over what is selected', () => {
    expect(buildConversationMentionTrigger('Hi there', 3, 8)).toEqual({ start: 3, end: 8, insert: '@' })
  })
})
