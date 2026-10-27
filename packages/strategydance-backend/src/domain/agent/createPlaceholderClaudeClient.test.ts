import { describe, expect, test } from 'bun:test'

import { CompanyAspect } from 'strategydance-database/backend'

import buildBillReceiptReadRequest from '~domain/budget/buildBillReceiptReadRequest'
import readBillReceiptFields from '~domain/budget/readBillReceiptFields'

import buildConversationTaggingRequest from './buildConversationTaggingRequest'
import createPlaceholderClaudeClient from './createPlaceholderClaudeClient'
import readConversationTagging from './readConversationTagging'

function ask(text: string, { stepDurationMs = 0, signal = new AbortController().signal } = {}) {
  const lines: string[] = []
  const answer = createPlaceholderClaudeClient({ stepDurationMs }).stream(
    {
      model: 'claude-opus-5-5',
      max_tokens: 1000,
      messages: [
        { role: 'user', content: [{ type: 'text', text }] },
        { role: 'system', content: [{ type: 'text', text: 'Context' }] },
      ],
    },
    { signal, onProgress: line => lines.push(line) },
  )

  return { answer, lines }
}

describe('createPlaceholderClaudeClient', () => {
  test('goes through its progress lines, then answers one text block counting the member’s message', async () => {
    const { answer, lines } = ask('Help me price the beta')
    const message = await answer

    expect(lines).toEqual(['Reading your message', 'Thinking it over', 'Weighing what to say', 'Writing a reply'])
    expect(message.stop_reason).toBe('end_turn')
    expect(message.content).toHaveLength(1)
    expect(message.content[0]).toMatchObject({ type: 'text' })
    expect(JSON.stringify(message.content[0])).toContain('**22**')
  })

  test('counts an image and a PDF at a fixed allowance rather than by their bytes', async () => {
    const client = createPlaceholderClaudeClient({ stepDurationMs: 0 })
    const data = 'A'.repeat(4_000_000)
    const counted = await client.countTokens({
      model: 'claude-opus-5-5',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } },
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data } },
            { type: 'text', text: 'What do they say?' },
          ],
        },
      ],
    })

    expect(counted).toBeGreaterThan(4500)
    expect(counted).toBeLessThan(5000)
  })

  test('counts an emoji, however many code units it takes, as one character', async () => {
    const message = await ask('Ship it 👍🏽').answer

    expect(JSON.stringify(message.content[0])).toContain('**9**')
  })

  test('tags a conversation at once with the strategy aspect, when asked for its schema’s answer', async () => {
    const lines: string[] = []
    const message = await createPlaceholderClaudeClient({ stepDurationMs: 1000 }).stream(
      buildConversationTaggingRequest({
        member: [{ type: 'text', text: 'Help me price the beta' }],
        reply: [{ type: 'text', text: 'Flat 19 per month.' }],
      }),
      { signal: new AbortController().signal, onProgress: line => lines.push(line) },
    )

    expect(lines).toEqual([])
    expect(readConversationTagging(message)).toEqual([CompanyAspect.STRATEGY])
  })

  test('reads a receipt at once into stand-in fields made from the file’s name, when asked for its schema', async () => {
    const lines: string[] = []
    const message = await createPlaceholderClaudeClient({ stepDurationMs: 1000 }).stream(
      buildBillReceiptReadRequest({
        file: { name: 'figma-invoice_october.pdf', contentType: 'application/pdf', bytes: new Uint8Array([37]) },
        today: '2026-10-27',
        organizationName: 'Acme Studio',
      }),
      { signal: new AbortController().signal, onProgress: line => lines.push(line) },
    )

    expect(lines).toEqual([])
    expect(message.model).toBe('claude-haiku-5-5')
    expect(readBillReceiptFields(message, { today: '2026-10-27' })).toEqual({
      name: 'Figma invoice october',
      description: 'Read by the placeholder',
      company: 'Placeholder company',
      amount: '42.00',
      currency: null,
      paidOn: '2026-10-27',
      recurrence: null,
    })
  })

  test('gives up when its worker aborts', async () => {
    const controller = new AbortController()
    const { answer } = ask('Hello', { stepDurationMs: 1000, signal: controller.signal })

    controller.abort()

    await expect(answer).rejects.toThrow()
  })
})
