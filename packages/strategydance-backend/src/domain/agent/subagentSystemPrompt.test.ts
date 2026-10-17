import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'

import SUBAGENT_SYSTEM_PROMPT from './subagentSystemPrompt'

describe('SUBAGENT_SYSTEM_PROMPT', () => {
  /*
    Its bytes are what every subagent's history was made with, so a change to them makes every
    existing subagent lose its earlier reasoning once. Change this hash only with a release that
    means to change the prompt
  */
  test('keeps its bytes', () => {
    expect(createHash('sha256').update(SUBAGENT_SYSTEM_PROMPT).digest('hex')).toBe(
      '2ddc4183822b0390ceca2ea5d1a7a455eac941e11df48242c0da9d0c9dba148c',
    )
  })

  test('holds no em dash, and no trailing space a formatter could take away', () => {
    expect(SUBAGENT_SYSTEM_PROMPT).not.toContain('—')
    expect(SUBAGENT_SYSTEM_PROMPT).not.toMatch(/[ \t]$/m)
  })
})
