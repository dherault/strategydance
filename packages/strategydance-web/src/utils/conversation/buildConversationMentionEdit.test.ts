import { describe, expect, it } from 'bun:test'

import buildConversationMentionEdit from '~utils/conversation/buildConversationMentionEdit'

describe('buildConversationMentionEdit', () => {
  it('writes the title over the query, and a space after it', () => {
    expect(buildConversationMentionEdit('Hi @pr', { at: 3, query: 'pr' }, 'Pricing')).toEqual({
      start: 3,
      end: 6,
      insert: '@Pricing ',
    })
  })

  it('writes no space when one already follows', () => {
    expect(buildConversationMentionEdit('@pr now', { at: 0, query: 'pr' }, 'Pricing')).toEqual({
      start: 0,
      end: 3,
      insert: '@Pricing',
    })
  })

  it('writes the title without the spaces around it', () => {
    expect(buildConversationMentionEdit('@', { at: 0, query: '' }, '  Hiring plan ')).toEqual({
      start: 0,
      end: 1,
      insert: '@Hiring plan ',
    })
  })
})
