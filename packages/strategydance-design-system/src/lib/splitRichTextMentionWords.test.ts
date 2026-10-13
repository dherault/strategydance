import { describe, expect, it } from 'bun:test'

import { splitRichTextMentionWords } from 'strategydance-design-system/lib/splitRichTextMentionWords'

describe('splitRichTextMentionWords', () => {
  it('keeps the first word apart from the rest, which wraps as text does', () => {
    expect(splitRichTextMentionWords('Launch the beta')).toEqual(['Launch', ' the beta'])
    expect(splitRichTextMentionWords('Pricing')).toEqual(['Pricing', ''])
    expect(splitRichTextMentionWords('')).toEqual(['', ''])
  })

  it('keeps no first word too long to stay whole', () => {
    expect(splitRichTextMentionWords(`${'x'.repeat(30)} plan`)).toEqual(['', `${'x'.repeat(30)} plan`])
  })
})
