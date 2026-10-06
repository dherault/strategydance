import { describe, expect, it } from 'bun:test'

import { ConversationMessageKind } from 'strategydance-database/web'

import type { Conversation } from '~types'

import isOlderConversation from '~utils/conversation/isOlderConversation'

// A conversation read at a revision and counter, its thread's newest message at `newest`
function conversation({ revision = 0, counter = 10, newest = 9, aspects = [] as Conversation['aspects'] } = {}) {
  return {
    historyRevision: revision,
    nextMessagePosition: counter,
    aspects,
    conversationMessages_on_conversation: [
      { id: `message-${newest}`, kind: ConversationMessageKind.AGENT_TEXT, position: newest },
    ],
  } as Conversation
}

describe('isOlderConversation', () => {
  it('takes a read behind in history or in its counter as older', () => {
    expect(isOlderConversation(conversation({ revision: 1 }), conversation({ revision: 0, counter: 20 }))).toBe(true)
    expect(isOlderConversation(conversation({ counter: 11, newest: 10 }), conversation())).toBe(true)
  })

  it('takes a read ahead in either as newer', () => {
    expect(isOlderConversation(conversation(), conversation({ revision: 1, counter: 5, newest: 4 }))).toBe(false)
    expect(isOlderConversation(conversation(), conversation({ counter: 11, newest: 10 }))).toBe(false)
  })

  it('takes a read holding a note Resume deleted since as older', () => {
    expect(isOlderConversation(conversation({ newest: 8 }), conversation({ newest: 9 }))).toBe(true)
  })

  it('takes a change in place at the same revision and counter as newer', () => {
    expect(isOlderConversation(conversation(), conversation({ aspects: [] }))).toBe(false)
  })

  it('never takes a conversation gone as older, nor one coming back', () => {
    expect(isOlderConversation(conversation(), undefined)).toBe(false)
    expect(isOlderConversation(undefined, conversation())).toBe(false)
  })
})
