import { describe, expect, it } from 'bun:test'

import parseInvitationEmails from './parseInvitationEmails'

const NONE = new Set<string>()

describe('parseInvitationEmails', () => {
  it('splits on commas, new lines, spaces and semicolons', () => {
    const { valid } = parseInvitationEmails('a@x.com, b@x.com\nc@x.com d@x.com;e@x.com', NONE, NONE)

    expect(valid).toEqual(['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com'])
  })

  it('normalizes and keeps each address once', () => {
    const { valid } = parseInvitationEmails('Jane@Company.com, jane@company.com ,JANE@COMPANY.COM', NONE, NONE)

    expect(valid).toEqual(['jane@company.com'])
  })

  it('reports what is not an address as it was typed', () => {
    const { valid, invalid } = parseInvitationEmails('jane@company.com, Sam@, nobody', NONE, NONE)

    expect(valid).toEqual(['jane@company.com'])
    expect(invalid).toEqual(['Sam@', 'nobody'])
  })

  it('sets members and pending invitations apart', () => {
    const parsed = parseInvitationEmails('member@x.com, Invited@x.com, new@x.com', new Set(['member@x.com']), new Set(['invited@x.com']))

    expect(parsed).toEqual({
      valid: ['new@x.com'],
      invalid: [],
      members: ['member@x.com'],
      invited: ['invited@x.com'],
    })
  })

  it('reads an empty field as nothing', () => {
    expect(parseInvitationEmails('  ,\n ', NONE, NONE)).toEqual({ valid: [], invalid: [], members: [], invited: [] })
  })
})
