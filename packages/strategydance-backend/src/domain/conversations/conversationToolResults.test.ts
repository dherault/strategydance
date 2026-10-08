import { describe, expect, test } from 'bun:test'

import {
  MAX_TOOL_RESULT_LENGTH,
  parsePendingToolResults,
  readFailedOutput,
  serializePendingToolResults,
  toFailedOutput,
  toSucceededResult,
  toToolOutput,
} from './conversationToolResults'

describe('toToolOutput', () => {
  test('keeps an output that fits as its JSON text', () => {
    expect(toToolOutput({ members: [{ name: 'Ada' }] })).toBe('{"members":[{"name":"Ada"}]}')
  })

  test('cuts a longer one, with a note, never inside a character', () => {
    const output = toToolOutput(`${'a'.repeat(MAX_TOOL_RESULT_LENGTH - 2)}🎉🎉`)

    expect(output.startsWith(`"${'a'.repeat(MAX_TOOL_RESULT_LENGTH - 2)}\n[Cut at`)).toBe(true)
    expect(output).toContain(`[Cut at ${MAX_TOOL_RESULT_LENGTH} characters of`)
  })
})

describe('pending results', () => {
  test('come back as they were kept, U+0000 included', () => {
    const content = JSON.stringify({ text: `acct${String.fromCharCode(0)}admin` })
    const pending = new Map([['toolu_1', toSucceededResult('toolu_1', content)]])

    expect(parsePendingToolResults(serializePendingToolResults(pending))).toEqual(pending)
    expect(parsePendingToolResults(null).size).toBe(0)
  })
})

describe('readFailedOutput', () => {
  test('reads the sentence a failed call shows, and nothing from another output', () => {
    expect(readFailedOutput(toFailedOutput('Not run.'))).toBe('Not run.')
    expect(readFailedOutput('{"results":[]}')).toBeNull()
    expect(readFailedOutput('not JSON')).toBeNull()
    expect(readFailedOutput(null)).toBeNull()
  })
})
