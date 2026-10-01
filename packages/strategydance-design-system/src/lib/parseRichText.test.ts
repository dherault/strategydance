import { describe, expect, it, spyOn } from 'bun:test'

import { parseRichText } from 'strategydance-design-system/lib/parseRichText'

describe('parseRichText', () => {
  it('reads a stored value as its blocks', () => {
    expect(parseRichText('[{"type":"paragraph","content":"Hi"}]')).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] },
    ])
  })

  it('keeps only the blocks it is asked for', () => {
    expect(parseRichText('[{"type":"quote","content":"Hi"}]', { blockTypes: ['paragraph'] })).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] },
    ])
  })

  it('reads nothing, and an old Lexical value, as no blocks without a word', () => {
    const error = spyOn(console, 'error').mockImplementation(() => {})

    expect(parseRichText(null)).toEqual([])
    expect(parseRichText('')).toEqual([])
    expect(parseRichText('{"root":{"type":"root","children":[]}}')).toEqual([])
    expect(error).not.toHaveBeenCalled()

    error.mockRestore()
  })

  it('reads a value that is not JSON as no blocks, and says so', () => {
    const error = spyOn(console, 'error').mockImplementation(() => {})

    expect(parseRichText('{not json')).toEqual([])
    expect(error).toHaveBeenCalledTimes(1)

    error.mockRestore()
  })
})
