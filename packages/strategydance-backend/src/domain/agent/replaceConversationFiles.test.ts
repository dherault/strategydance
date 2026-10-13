import { describe, expect, it } from 'bun:test'

import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import replaceConversationFiles from './replaceConversationFiles'

const FILE_TOKENS = new Map([
  ['file_board', 371],
  ['file_plan', 1594],
])

describe('replaceConversationFiles', () => {
  it('takes every file out and sums what each counted, leaving the rest as it was', () => {
    const messages: BetaMessageParam[] = [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'file', file_id: 'file_board' } },
          { type: 'document', source: { type: 'file', file_id: 'file_plan' }, title: 'Plan.pdf' },
          { type: 'text', text: 'What do these say?' },
        ],
      },
      { role: 'assistant', content: [{ type: 'text', text: 'A board and a plan.' }] },
    ]
    const replaced = replaceConversationFiles(messages, FILE_TOKENS)

    expect(replaced.fileTokens).toBe(1965)
    expect(replaced.messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'What do these say?' }] },
      messages[1] as BetaMessageParam,
    ])
    expect(replaced.messages[1]).toBe(messages[1] as BetaMessageParam)
  })

  it('leaves a dot in a message of files alone, and an inline file where it is', () => {
    const inline: BetaMessageParam = {
      role: 'user',
      content: [{ type: 'document', source: { type: 'text', media_type: 'text/plain', data: 'Hi' } }],
    }
    const replaced = replaceConversationFiles(
      [{ role: 'user', content: [{ type: 'image', source: { type: 'file', file_id: 'file_board' } }] }, inline],
      FILE_TOKENS,
    )

    expect(replaced.messages).toEqual([{ role: 'user', content: [{ type: 'text', text: '.' }] }, inline])
    expect(replaced.fileTokens).toBe(371)
  })

  it('refuses a file no count is known for', () => {
    expect(() =>
      replaceConversationFiles(
        [{ role: 'user', content: [{ type: 'image', source: { type: 'file', file_id: 'file_unknown' } }] }],
        FILE_TOKENS,
      ),
    ).toThrow('file_unknown')
  })
})
