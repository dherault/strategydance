import { describe, expect, it } from 'bun:test'

import { getInitials } from 'strategydance-design-system/lib/getInitials'

describe('getInitials', () => {
  it('reads the first letter of the first two words, uppercased', () => {
    expect(getInitials('Strategy Dance')).toBe('SD')
    expect(getInitials('acme inc. worldwide')).toBe('AI')
  })

  it('reads one letter for one word, whatever the spacing', () => {
    expect(getInitials('Acme')).toBe('A')
    expect(getInitials('  acme  ')).toBe('A')
  })

  it('keeps a character outside the basic plane whole', () => {
    expect(getInitials('🚀 Launch')).toBe('🚀L')
  })

  it('keeps a character drawn from several code points whole', () => {
    expect(getInitials('🇫🇷 France')).toBe('🇫🇷F')
    expect(getInitials('👨‍👩‍👧 Family')).toBe('👨‍👩‍👧F')
    // An e followed by a combining acute accent, which renders as one é
    expect(getInitials('étoile nord')).toBe('ÉN')
  })

  it('reads nothing out of an empty name', () => {
    expect(getInitials('')).toBe('')
    expect(getInitials('   ')).toBe('')
  })
})
