import { describe, expect, test } from 'bun:test'

import createPlaceholderClaudeClient from './createPlaceholderClaudeClient'

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

  test('counts an emoji, however many code units it takes, as one character', async () => {
    const message = await ask('Ship it 👍🏽').answer

    expect(JSON.stringify(message.content[0])).toContain('**9**')
  })

  test('gives up when its worker aborts', async () => {
    const controller = new AbortController()
    const { answer } = ask('Hello', { stepDurationMs: 1000, signal: controller.signal })

    controller.abort()

    await expect(answer).rejects.toThrow()
  })
})
