import { describe, expect, it } from 'bun:test'

import { hasRichText } from 'strategydance-design-system/lib/hasRichText'

describe('hasRichText', () => {
  it('says a value with words says something', () => {
    expect(hasRichText('[{"type":"checkListItem","content":"Call Ada"}]')).toBe(true)
  })

  it('says nothing, blanks and an old Lexical value say nothing', () => {
    expect(hasRichText(null)).toBe(false)
    expect(hasRichText('[]')).toBe(false)
    expect(hasRichText('[{"type":"paragraph","content":"  "},{"type":"paragraph"}]')).toBe(false)
    expect(hasRichText('{"root":{"type":"root","children":[{"type":"paragraph"}]}}')).toBe(false)
  })

  it('says a picture says something', () => {
    expect(hasRichText('[{"type":"image","props":{"url":"https://example.com/a.png"}}]')).toBe(true)
    expect(hasRichText('[{"type":"image"}]')).toBe(false)
  })
})
