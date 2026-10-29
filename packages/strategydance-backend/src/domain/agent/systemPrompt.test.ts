import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'

import CONVERSATION_SYSTEM_PROMPT from './systemPrompt'

describe('CONVERSATION_SYSTEM_PROMPT', () => {
  /*
    Its bytes are what every conversation's history was made with, so a change to them makes every
    existing conversation lose its earlier reasoning once. Change this hash only with a release that
    means to change the prompt
  */
  test('keeps its bytes', () => {
    expect(createHash('sha256').update(CONVERSATION_SYSTEM_PROMPT).digest('hex')).toBe(
      'e3bfa6d52a3ffa727f1e88829161e512e01b09868fee7adfd6985cf06c9173ce',
    )
  })

  test('holds no em dash, and no trailing space a formatter could take away', () => {
    expect(CONVERSATION_SYSTEM_PROMPT).not.toContain('—')
    expect(CONVERSATION_SYSTEM_PROMPT).not.toMatch(/[ \t]$/m)
  })
})
