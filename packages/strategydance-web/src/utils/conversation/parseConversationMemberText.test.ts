import { describe, expect, it } from 'bun:test'

import parseConversationMemberText from '~utils/conversation/parseConversationMemberText'

const ID = '9f8e7d6c5b4a43219f8e7d6c5b4a4321'
// As many hex digits as an id with its hyphens has characters, which no id is
const NOT_AN_ID = 'a'.repeat(36)

describe('parseConversationMemberText', () => {
  it('cuts a mention out of the text around it', () => {
    expect(parseConversationMemberText(`Review [Pricing](doc:${ID}) now`)).toEqual([
      { kind: 'text', text: 'Review ' },
      { kind: 'document', href: `doc:${ID}`, label: 'Pricing' },
      { kind: 'text', text: ' now' },
    ])
  })

  it('reads two mentions, and one at either end', () => {
    expect(parseConversationMemberText(`[A](doc:${ID}) and [B](doc:${ID})`)).toEqual([
      { kind: 'document', href: `doc:${ID}`, label: 'A' },
      { kind: 'text', text: ' and ' },
      { kind: 'document', href: `doc:${ID}`, label: 'B' },
    ])
  })

  it('undoes the escapes of a title holding brackets and backslashes', () => {
    expect(parseConversationMemberText(`[Q3 \\[draft\\] \\\\ notes](doc:${ID})`)).toEqual([
      { kind: 'document', href: `doc:${ID}`, label: 'Q3 [draft] \\ notes' },
    ])
  })

  it('reads an id with its hyphens, and a scheme in any case', () => {
    const href = 'DOC:9f8e7d6c-5b4a-4321-9f8e-7d6c5b4a4321'

    expect(parseConversationMemberText(`[Pricing](${href})`)).toEqual([{ kind: 'document', href, label: 'Pricing' }])
  })

  it('keeps as typed a web link, an escaped bracket, a malformed id, empty words and Markdown', () => {
    for (const text of [
      '[Stripe](https://stripe.com)',
      `\\[Pricing](doc:${ID})`,
      `[Pricing](doc:${NOT_AN_ID})`,
      `[](doc:${ID})`,
      '**bold** and\n- a line',
    ]) {
      expect(parseConversationMemberText(text)).toEqual([{ kind: 'text', text }])
    }
  })

  it('keeps the text around a link it does not read', () => {
    expect(parseConversationMemberText(`a [x](doc:${NOT_AN_ID}) b [P](doc:${ID})`)).toEqual([
      { kind: 'text', text: `a [x](doc:${NOT_AN_ID}) b ` },
      { kind: 'document', href: `doc:${ID}`, label: 'P' },
    ])
  })

  it('cuts nothing out of an empty text', () => {
    expect(parseConversationMemberText('')).toEqual([])
  })
})
