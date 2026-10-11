import { describe, expect, it } from 'bun:test'

import parseConversationMemberText from '~utils/conversation/parseConversationMemberText'
import serializeConversationMentions from '~utils/conversation/serializeConversationMentions'

const PRICING_ID = '9f8e7d6c5b4a43219f8e7d6c5b4a4321'
const DRAFT_ID = '1a2b3c4d5e6f40718293a4b5c6d7e8f9'
const MENTIONS = new Map([
  ['Pricing', PRICING_ID],
  ['Q3 [draft] \\ notes', DRAFT_ID],
])

describe('serializeConversationMentions', () => {
  it('sends each mention as a link to its document', () => {
    expect(serializeConversationMentions('Compare @Pricing with @Q3 [draft] \\ notes.', MENTIONS)).toBe(
      `Compare [Pricing](doc:${PRICING_ID}) with [Q3 \\[draft\\] \\\\ notes](doc:${DRAFT_ID}).`,
    )
  })

  it('sends the same mention twice', () => {
    expect(serializeConversationMentions('@Pricing, @Pricing', MENTIONS)).toBe(
      `[Pricing](doc:${PRICING_ID}), [Pricing](doc:${PRICING_ID})`,
    )
  })

  it('sends the text as written when it mentions nothing tracked', () => {
    expect(serializeConversationMentions('Email me@Pricing or @Pricin', MENTIONS)).toBe('Email me@Pricing or @Pricin')
    expect(serializeConversationMentions('@Pricing', new Map())).toBe('@Pricing')
  })

  it('sends what the bubble reads back as the titles mentioned', () => {
    const segments = parseConversationMemberText(
      serializeConversationMentions('@Q3 [draft] \\ notes, @Pricing', MENTIONS),
    )

    expect(segments.flatMap(segment => (segment.kind === 'document' ? [segment.label] : []))).toEqual([
      'Q3 [draft] \\ notes',
      'Pricing',
    ])
  })
})
