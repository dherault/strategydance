import { describe, expect, it } from 'bun:test'

import type { ConversationAuthor, ConversationSummary } from '~types'

import filterConversationsByAuthor from '~utils/conversation/filterConversationsByAuthor'
import listConversationAuthors from '~utils/conversation/listConversationAuthors'

function author(id: string, displayName: string | null, email = `${id}@example.com`): ConversationAuthor {
  return { id, email, displayName, imageUrl: null, imageThumbnailUrl: null }
}

const READER = author('reader', 'Reader')
const ZOE = author('zoe', 'Zoé')
const ADA = author('ada', null, 'ada@example.com')

function conversation(id: string, user: ConversationAuthor) {
  return { id, user } as ConversationSummary
}

const conversations = [
  conversation('1', ZOE),
  conversation('2', READER),
  conversation('3', ADA),
  conversation('4', ZOE),
]

describe('filterConversationsByAuthor', () => {
  it('keeps every conversation for everybody, and the reader’s or an author’s alone, in order', () => {
    expect(filterConversationsByAuthor(conversations, 'all', READER.id)).toBe(conversations)
    expect(filterConversationsByAuthor(conversations, 'me', READER.id).map(({ id }) => id)).toEqual(['2'])
    expect(filterConversationsByAuthor(conversations, 'user:zoe', READER.id).map(({ id }) => id)).toEqual(['1', '4'])
  })

  it('keeps nothing for an author the list no longer holds, or a reader not known yet', () => {
    expect(filterConversationsByAuthor(conversations, 'user:gone', READER.id)).toEqual([])
    expect(filterConversationsByAuthor(conversations, 'me', null)).toEqual([])
  })
})

describe('listConversationAuthors', () => {
  it('names each other author once, by the name on their account or their address', () => {
    expect(listConversationAuthors(conversations, READER.id)).toEqual([ADA, ZOE])
  })
})
