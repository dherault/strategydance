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

  test('cuts a longer one into JSON still, within the bound, with a note, never inside a character', () => {
    const output = toToolOutput(`${'a'.repeat(MAX_TOOL_RESULT_LENGTH)}🎉🎉`)
    const parsed = JSON.parse(output) as { note: string; text: string }

    expect(output.length).toBeLessThanOrEqual(MAX_TOOL_RESULT_LENGTH)
    expect(parsed.note).toContain('cut')
    expect(parsed.text.startsWith('"aaa')).toBe(true)
    expect(parsed.text).not.toMatch(/[\uD800-\uDBFF]$/)
  })

  test('keeps a cut within the bound when escaping its text makes it longer', () => {
    const output = toToolOutput({ quotes: '"'.repeat(MAX_TOOL_RESULT_LENGTH) })

    expect(output.length).toBeLessThanOrEqual(MAX_TOOL_RESULT_LENGTH)
    expect(() => JSON.parse(output)).not.toThrow()
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
