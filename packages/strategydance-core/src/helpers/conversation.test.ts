import { describe, expect, it } from 'bun:test'

import { MAX_CONVERSATION_PREVIEW_LENGTH } from '../constants'

import { buildConversationPreview } from './conversation'

function previewText(text: string) {
  const preview = buildConversationPreview({ kind: 'AGENT_TEXT', text })

  if (preview?.kind !== 'AGENT_TEXT') throw new Error('Expected a text preview')

  return preview.text
}

describe('buildConversationPreview', () => {
  it('keeps who wrote a text message', () => {
    expect(buildConversationPreview({ kind: 'MEMBER_TEXT', text: 'Help me price the beta' })).toEqual({
      kind: 'MEMBER_TEXT',
      text: 'Help me price the beta',
    })
    expect(buildConversationPreview({ kind: 'AGENT_TEXT', text: 'Flat 19 per month it is.' })).toEqual({
      kind: 'AGENT_TEXT',
      text: 'Flat 19 per month it is.',
    })
  })

  it('reads a reply as the design does, its list joined by commas after the colon that opens it', () => {
    expect(
      previewText(
        'You already have 2 prices in Stripe: **19 per month** and **190 per year**. Your [Pricing options](doc:d4) note lists 3 models:\n\n- Flat 19 per month\n- Free tier with 1 aspect, then 29 per month\n- Usage-based on AI tasks',
      ),
    ).toBe(
      'You already have 2 prices in Stripe: 19 per month and 190 per year. Your Pricing options note lists 3 models: Flat 19 per month, Free tier with 1 aspect, then 29 per month, Usage-based on AI tasks',
    )
  })

  it('joins a numbered list, and a list after a sentence, with commas', () => {
    expect(previewText('Three steps\n\n1. Draft\n2) Review\n3. Ship')).toBe('Three steps, Draft, Review, Ship')
    expect(previewText('- [ ] Call Ana\n- [x] Send the deck')).toBe('Call Ana, Send the deck')
  })

  it('leaves tables, fences and rules out', () => {
    expect(
      previewText('Here is the comparison:\n\n| Plan | Price |\n| --- | --- |\n| Flat | 19 |\n\n---\n\nFlat wins.'),
    ).toBe('Here is the comparison: Flat wins.')
    expect(previewText('Run this:\n\n```\nbun run dev\n```')).toBe('Run this: bun run dev')
    expect(previewText('One\n\n* * *\n\n___\n\n-*-\n\nTwo')).toBe('One -*- Two')
  })

  it('leaves out a table whose outer pipes are left out, and its rows without a pipe', () => {
    expect(previewText('Here is the comparison:\n\nPlan | Price\n:--- | ---:\nFlat | 19\nFree\n\nFlat wins.')).toBe(
      'Here is the comparison: Flat wins.',
    )
  })

  it('ends a table at the next block, and keeps a pipe outside one', () => {
    expect(previewText('| Plan | Price |\n| - | - |\n| Flat | 19 |\n- Pick Flat\n- Ship it')).toBe('Pick Flat, Ship it')
    expect(previewText('| Plan | Price |\n| - | - |\n| Flat | 19 |\n---\nFlat wins.')).toBe('Flat wins.')
    expect(previewText('Pipe it as a | b\n\nthen run it.')).toBe('Pipe it as a | b then run it.')
  })

  it('never opens a table on a line that starts another block', () => {
    expect(previewText('# Plan | Price\n--- | ---')).toBe('Plan | Price --- | ---')
  })

  it('leaves out a table inside a quote, and ends a table where a quote starts', () => {
    expect(previewText('> Plan | Price\n> --- | ---\n> Flat | 19\n\nFlat wins.')).toBe('Flat wins.')
    expect(previewText('> > | Plan |\n> > | --- |\n> > | Flat |\n> Back to the quote')).toBe('Back to the quote')
    expect(previewText('| Plan | Price |\n| --- | --- |\n| Flat | 19 |\n> Flat wins.')).toBe('Flat wins.')
  })

  it('strips heading and quote markers', () => {
    expect(previewText('## Next steps ##\n\n> Ship it on **Monday**')).toBe('Next steps Ship it on Monday')
  })

  it('reads a knowledge mention as its title, escapes and all', () => {
    expect(
      buildConversationPreview({
        kind: 'MEMBER_TEXT',
        text: 'Read [Q3 \\[draft\\] \\\\ notes](doc:0b6f8a52-5c8f-4d7e-9a3b-2f1e6d4c8b7a) first',
      }),
    ).toEqual({ kind: 'MEMBER_TEXT', text: 'Read Q3 [draft] \\ notes first' })
  })

  it('takes inline markup down to its text', () => {
    expect(previewText('This is *really* _quite_ ~~not~~ __so__ done')).toBe('This is really quite not so done')
    expect(previewText('Call **`read_knowledge`** first, see <https://strategydance.com>')).toBe(
      'Call read_knowledge first, see https://strategydance.com',
    )
    expect(previewText('Use \\*args\\* here')).toBe('Use *args* here')
    expect(previewText('Write to <ana@example.com> or <mailto:ben@example.com>')).toBe(
      'Write to ana@example.com or mailto:ben@example.com',
    )
  })

  it('reads nested emphasis, and a link whose address holds parentheses', () => {
    expect(previewText('**bold *italic* text** and __more _of_ it__, ~~a ~ b~~')).toBe(
      'bold italic text and more of it, a ~ b',
    )
    expect(previewText('***both*** and *a **b** c*')).toBe('both and a b c')
    expect(previewText('See [Function](https://en.wikipedia.org/wiki/Function_(mathematics)) first')).toBe(
      'See Function first',
    )
  })

  it('reads code spans as CommonMark pairs their backticks', () => {
    expect(previewText('Write `` `foo` `` to quote it')).toBe('Write `foo` to quote it')
    expect(previewText('A ``span with ` inside`` and `one`')).toBe('A span with ` inside and one')
    expect(previewText('It`s left ``open')).toBe('It`s left ``open')
    expect(previewText('Not \\`code` here')).toBe('Not `code` here')
    expect(previewText('A \\\\`code` here')).toBe('A \\code here')
    expect(previewText('Not \\\\\\`code` here')).toBe('Not \\`code` here')
  })

  it('keeps what a code span holds as written', () => {
    expect(previewText('Write `*literal*`, `\\*` and `[a](b)` as is')).toBe('Write *literal*, \\* and [a](b) as is')
    expect(previewText('**Call `read_knowledge`** in [`search`](doc:a)')).toBe('Call read_knowledge in search')
  })

  it('lets a backslash keep a run of backticks from opening a code span, never from closing one', () => {
    expect(previewText('Type `a\\` then `b`')).toBe('Type a\\ then b')
    expect(previewText('Type \\``a` then')).toBe('Type `a then')
  })

  it('keeps an underscore inside a word', () => {
    expect(previewText('I called read_knowledge and search_knowledge.')).toBe(
      'I called read_knowledge and search_knowledge.',
    )
  })

  it('drops control characters, U+0000 included, and collapses whitespace', () => {
    expect(previewText('a\u0000b\tc\u0007d\r\n\r\n  e')).toBe('ab cd e')
  })

  it('cuts a long reply to its length, with an ellipsis', () => {
    const text = previewText('word '.repeat(4000))

    expect(text.length).toBeLessThanOrEqual(MAX_CONVERSATION_PREVIEW_LENGTH)
    expect(text.endsWith('word…')).toBe(true)
  })

  it('never splits a grapheme at the cut', () => {
    const family = '👨‍👩‍👧‍👦'

    expect(previewText(`${'a'.repeat(195)}${family}tail`)).toBe(`${'a'.repeat(195)}…`)
    expect(previewText(`${'a'.repeat(190)}👍🏽${'b'.repeat(20)}`)).toBe(`${'a'.repeat(190)}👍🏽bbbbb…`)
  })

  it('reads a message full of unpaired delimiters without searching past each one', () => {
    const start = process.cpuUsage()

    for (const unit of [
      '[a',
      '[a](x(',
      '\\[',
      'a | b\n',
      '![a](',
      '*a ',
      '**a *b',
      '_a ',
      '~~a ',
      '`a',
      '``a`',
      '<https:',
      '- a\n',
      'a:\n- b\n',
    ]) {
      buildConversationPreview({ kind: 'MEMBER_TEXT', text: unit.repeat(Math.ceil(20000 / unit.length)) })
    }

    // The time spent on the processor, which a busy machine does not stretch as it stretches the
    // time on the clock: about a millisecond each, where a pattern that searched past its next
    // delimiter took seconds
    const { user, system } = process.cpuUsage(start)

    expect((user + system) / 1000).toBeLessThan(1000)
  })

  it('keeps a text that fits as it is', () => {
    const text = 'a'.repeat(MAX_CONVERSATION_PREVIEW_LENGTH)

    expect(previewText(text)).toBe(text)
  })

  it('keeps a tool call’s name and status', () => {
    for (const toolStatus of ['RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'] as const) {
      expect(buildConversationPreview({ kind: 'TOOL_CALL', toolName: 'search_knowledge', toolStatus })).toEqual({
        kind: 'TOOL_CALL',
        toolName: 'search_knowledge',
        toolStatus,
      })
    }
  })

  it('shows a question’s prompt while it waits and once it is skipped', () => {
    const question = { kind: 'QUESTION', questionPrompt: 'Which model should the beta start with?' } as const

    expect(buildConversationPreview(question)).toEqual({
      kind: 'QUESTION',
      questionState: 'WAITING',
      text: 'Which model should the beta start with?',
    })
    expect(buildConversationPreview({ ...question, isAnswerSkipped: true })).toEqual({
      kind: 'QUESTION',
      questionState: 'SKIPPED',
      text: 'Which model should the beta start with?',
    })
  })

  it('shows an answered question’s answer, the options chosen before the member’s own words', () => {
    const question = { kind: 'QUESTION', questionPrompt: 'Where will you announce the launch?' } as const

    expect(
      buildConversationPreview({
        ...question,
        answerSelected: ['X', 'Product Hunt'],
        answerOther: ' The Solo Founders Slack ',
      }),
    ).toEqual({ kind: 'QUESTION', questionState: 'ANSWERED', text: 'X, Product Hunt, The Solo Founders Slack' })
    expect(buildConversationPreview({ ...question, answerSelected: ['X'], answerOther: '' })).toEqual({
      kind: 'QUESTION',
      questionState: 'ANSWERED',
      text: 'X',
    })
    expect(buildConversationPreview({ ...question, answerSelected: [], answerOther: 'Nowhere yet' })).toEqual({
      kind: 'QUESTION',
      questionState: 'ANSWERED',
      text: 'Nowhere yet',
    })
  })

  it('keeps a note’s kind', () => {
    for (const noteKind of ['STOPPED', 'FAILED', 'REFUSED', 'INTERRUPTED', 'FULL'] as const) {
      expect(buildConversationPreview({ kind: 'NOTE', noteKind })).toEqual({ kind: 'NOTE', noteKind })
    }
  })

  it('never makes an aspects note the preview', () => {
    expect(buildConversationPreview({ kind: 'ASPECTS' })).toBeNull()
  })

  it('refuses a tool call or a note missing what its preview shows', () => {
    expect(() => buildConversationPreview({ kind: 'TOOL_CALL', toolStatus: 'RUNNING' })).toThrow()
    expect(() => buildConversationPreview({ kind: 'NOTE' })).toThrow()
  })
})
