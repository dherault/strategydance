import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'

import CONVERSATION_TOOLS from './conversationTools'

describe('CONVERSATION_TOOLS', () => {
  /*
    Its bytes, like the system prompt's, are what every conversation's history was made with, so a
    change to them makes every existing conversation lose its earlier reasoning once. Change this
    hash only with a release that means to change the tools
  */
  test('keeps its bytes', () => {
    expect(createHash('sha256').update(JSON.stringify(CONVERSATION_TOOLS)).digest('hex')).toBe(
      'd555af9b9e31b405d36a26bf9adf0e455f1e9a916879eacfddcce15fb3090cd1',
    )
  })

  test('names each tool once, and describes Strategy Dance’s own without an em dash', () => {
    const names = CONVERSATION_TOOLS.map(tool => ('name' in tool ? tool.name : tool.type))

    expect(new Set(names).size).toBe(names.length)
    expect(JSON.stringify(CONVERSATION_TOOLS)).not.toContain('—')
  })
})
