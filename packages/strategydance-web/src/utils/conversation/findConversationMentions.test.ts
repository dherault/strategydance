import { describe, expect, it } from 'bun:test'

import findConversationMentions from '~utils/conversation/findConversationMentions'

const MENTIONS = new Map([
  ['Pricing', 'p'],
  ['Plan', 'a'],
  ['Plan B', 'b'],
  ['Q3 @ Acme', 'q'],
])

function titles(text: string) {
  return findConversationMentions(text, MENTIONS).map(({ title }) => title)
}

describe('findConversationMentions', () => {
  it('finds a mention, from its `@` to the end of its title', () => {
    expect(findConversationMentions('Ask @Pricing now', MENTIONS)).toEqual([
      { start: 4, end: 12, title: 'Pricing', id: 'p' },
    ])
  })

  it('takes the longest title that fits', () => {
    expect(titles('@Plan B and @Plan')).toEqual(['Plan B', 'Plan'])
  })

  it('finds a title only where a word ends', () => {
    expect(titles('@Planning')).toEqual([])
    expect(titles('@Plans')).toEqual([])
    expect(titles('@Plan_2026')).toEqual([])
    expect(titles('@Pricing, then @Plan.')).toEqual(['Pricing', 'Plan'])
  })

  it('finds no title followed by an accent written as a mark of its own', () => {
    expect(findConversationMentions('@Cafe\u0301', new Map([['Cafe', 'c']]))).toEqual([])
    expect(findConversationMentions('@Cafe!', new Map([['Cafe', 'c']]))).toEqual([
      { start: 0, end: 5, title: 'Cafe', id: 'c' },
    ])
  })

  it('finds an `@` only at the start or after a space', () => {
    expect(titles('a@Pricing')).toEqual([])
    expect(titles('x\n@Pricing')).toEqual(['Pricing'])
  })

  it('finds no title cut short, nor one in another case', () => {
    expect(titles('@Pricin')).toEqual([])
    expect(titles('@pricing')).toEqual([])
  })

  it('never reads a title holding an `@` again inside it', () => {
    expect(findConversationMentions('@Q3 @ Acme', MENTIONS)).toEqual([
      { start: 0, end: 10, title: 'Q3 @ Acme', id: 'q' },
    ])
  })

  it('finds the same mention twice', () => {
    expect(titles('@Pricing or @Pricing')).toEqual(['Pricing', 'Pricing'])
  })

  it('finds nothing when no title is tracked', () => {
    expect(findConversationMentions('@Pricing', new Map())).toEqual([])
  })
})
