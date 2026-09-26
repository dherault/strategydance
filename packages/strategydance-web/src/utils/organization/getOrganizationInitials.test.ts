import { describe, expect, it } from 'bun:test'

import getOrganizationInitials from './getOrganizationInitials'

describe('getOrganizationInitials', () => {
  it('reads the first letter of the first two words, uppercased', () => {
    expect(getOrganizationInitials('Strategy Dance')).toBe('SD')
    expect(getOrganizationInitials('acme inc. worldwide')).toBe('AI')
  })

  it('reads one letter for one word, whatever the spacing', () => {
    expect(getOrganizationInitials('Acme')).toBe('A')
    expect(getOrganizationInitials('  acme  ')).toBe('A')
  })

  it('keeps a character outside the basic plane whole', () => {
    expect(getOrganizationInitials('🚀 Launch')).toBe('🚀L')
  })

  it('keeps a character drawn from several code points whole', () => {
    expect(getOrganizationInitials('🇫🇷 France')).toBe('🇫🇷F')
    expect(getOrganizationInitials('👨‍👩‍👧 Family')).toBe('👨‍👩‍👧F')
    // An e followed by a combining acute accent, which renders as one é
    expect(getOrganizationInitials('e\u0301toile nord')).toBe('E\u0301N')
  })

  it('reads nothing out of an empty name', () => {
    expect(getOrganizationInitials('')).toBe('')
    expect(getOrganizationInitials('   ')).toBe('')
  })
})
