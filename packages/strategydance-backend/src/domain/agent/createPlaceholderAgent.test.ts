import { describe, expect, test } from 'bun:test'

import createPlaceholderAgent from './createPlaceholderAgent'

describe('createPlaceholderAgent', () => {
  test('goes through its progress lines, then answers one text block counting the message', async () => {
    const steps: string[] = []
    const { content } = await createPlaceholderAgent({ stepDurationMs: 0 }).respond({
      lastEntry: [{ type: 'text', text: 'Help me price the beta' }],
      signal: new AbortController().signal,
      onStep: step => steps.push(step),
    })

    expect(steps).toEqual(['Reading your message', 'Thinking it over', 'Weighing what to say', 'Writing a reply'])
    expect(content).toHaveLength(1)
    expect(content[0]).toMatchObject({ type: 'text' })
    expect(String(content[0]?.text)).toContain('**22**')
  })

  test('counts an emoji, however many code units it takes, as one character', async () => {
    const { content } = await createPlaceholderAgent({ stepDurationMs: 0 }).respond({
      lastEntry: [{ type: 'text', text: 'Ship it 👍🏽' }],
      signal: new AbortController().signal,
      onStep: () => {},
    })

    expect(String(content[0]?.text)).toContain('**9**')
  })

  test('gives up when its worker aborts', async () => {
    const controller = new AbortController()
    const answer = createPlaceholderAgent({ stepDurationMs: 1000 }).respond({
      lastEntry: [],
      signal: controller.signal,
      onStep: () => {},
    })

    controller.abort()

    await expect(answer).rejects.toThrow()
  })
})
