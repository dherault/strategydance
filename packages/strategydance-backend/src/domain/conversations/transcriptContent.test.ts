import { describe, expect, test } from 'bun:test'

import parseTranscriptContent from './parseTranscriptContent'
import serializeTranscriptContent from './serializeTranscriptContent'

describe('transcript content', () => {
  test('stores a turn holding U+0000 and keys out of alphabetical order, and reads it back as the same bytes', () => {
    const content = [
      { type: 'text', text: 'Before\u0000after' },
      { type: 'tool_use', id: 'toolu_1', name: 'read_knowledge', input: { zebra: 1, apple: { b: 2, a: 1 } } },
    ]
    const stored = serializeTranscriptContent(content)
    const read = parseTranscriptContent(stored)

    expect(stored.includes('\u0000')).toBe(false)
    expect(serializeTranscriptContent(read)).toBe(stored)
    expect(Object.keys(read[1]?.input as object)).toEqual(['zebra', 'apple'])
    expect(read[0]?.text).toBe('Before\u0000after')
  })

  test('refuses what is not a list of content blocks', () => {
    expect(() => parseTranscriptContent('{"type":"text"}')).toThrow()
    expect(() => parseTranscriptContent('[{"text":"no type"}]')).toThrow()
    expect(() => parseTranscriptContent('[null]')).toThrow()
  })
})
