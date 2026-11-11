import { describe, expect, it } from 'bun:test'

import { readLinkPreviewHost } from 'strategydance-design-system/lib/readLinkPreviewHost'

describe('readLinkPreviewHost', () => {
  it("reads a web address's host without its www.", () => {
    expect(readLinkPreviewHost('https://www.example.com/page')).toBe('example.com')
    expect(readLinkPreviewHost('http://docs.example.org/?q=1')).toBe('docs.example.org')
  })

  it('reads nothing of an address that is not a web one', () => {
    expect(readLinkPreviewHost('mailto:someone@example.com')).toBeNull()
    expect(readLinkPreviewHost('example.com')).toBeNull()
    expect(readLinkPreviewHost('')).toBeNull()
  })
})
