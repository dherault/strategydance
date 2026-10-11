import { describe, expect, it } from 'bun:test'

import findConversationMentionQuery from '~utils/conversation/findConversationMentionQuery'

const MENTIONS = new Map([
  ['Pricing', 'p'],
  ['Q3 @ Acme', 'q'],
])

function find(text: string, caret = text.length) {
  return findConversationMentionQuery(text, caret, MENTIONS)
}

describe('findConversationMentionQuery', () => {
  it('reads what follows an `@` up to the caret', () => {
    expect(find('@')).toEqual({ at: 0, query: '' })
    expect(find('Hi @pri')).toEqual({ at: 3, query: 'pri' })
    expect(find('Hi @launch plan')).toEqual({ at: 3, query: 'launch plan' })
    expect(find('Hi\n@pri')).toEqual({ at: 3, query: 'pri' })
  })

  it('reads up to the caret alone, wherever it is', () => {
    expect(find('Hi @pricing', 7)).toEqual({ at: 3, query: 'pri' })
    expect(find('Hi @pricing', 2)).toBeNull()
  })

  it('reads no `@` inside a word, nor a query past its line, past 40 characters or past another `@`', () => {
    expect(find('a@b')).toBeNull()
    expect(find('@pri\ncing')).toBeNull()
    expect(find(`@${'a'.repeat(41)}`)).toBeNull()
    expect(find(`@${'a'.repeat(40)}`)).toEqual({ at: 0, query: 'a'.repeat(40) })
    expect(find('@@')).toBeNull()
  })

  it('reads no mention already picked, but the next one typed after it', () => {
    expect(find('@Pricing ')).toBeNull()
    expect(find('@Pricing')).toBeNull()
    expect(find('@Q3 @ Acme ')).toBeNull()
    expect(find('@Pricing @pl')).toEqual({ at: 9, query: 'pl' })
  })

  it('reads a mention changed by hand as a query again', () => {
    expect(find('@Pricin')).toEqual({ at: 0, query: 'Pricin' })
  })
})
