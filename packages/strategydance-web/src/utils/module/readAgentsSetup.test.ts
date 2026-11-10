import { describe, expect, mock, test } from 'bun:test'

import { PRODUCTION_API_URL } from 'strategydance-core'

// The deployed backend, as every page but the emulators' calls it
mock.module('~data/api', () => ({ API_URL: PRODUCTION_API_URL }))

const { default: readAgentsSetup } = await import('~utils/module/readAgentsSetup')

describe('readAgentsSetup', () => {
  test('gives the one address, the same on every module page', () => {
    expect(readAgentsSetup().address).toBe('https://api.strategydance.com/mcp')
  })

  test('names the server strategydance in Claude Code and Cursor', () => {
    const { claudeCode, cursor } = readAgentsSetup()

    expect(claudeCode).toBe('claude mcp add --transport http strategydance https://api.strategydance.com/mcp')
    expect(JSON.parse(cursor)).toEqual({ mcpServers: { strategydance: { url: 'https://api.strategydance.com/mcp' } } })
  })
})
