import { describe, expect, it } from 'bun:test'

import classifyInvitationFailure from './classifyInvitationFailure'

// The shapes the Admin SDK reports, captured from the emulator: the cause first, then every
// other `@check` of the rolled-back transaction marked `(aborted)`
const DUPLICATE = 'violates SQL unique constraint: organization_invitation_organizationId_email_uidx\nOnly an administrator can invite people (aborted)\nOnly a member of an organization can invite people to it (aborted) (aborted)'
const NOT_ADMINISTRATOR = 'Only an administrator can invite people (aborted)\n(rolled back) (aborted)'

describe('classifyInvitationFailure', () => {
  it('reads a second invitation for the address as a conflict, whatever follows the cause', () => {
    expect(classifyInvitationFailure(new Error(DUPLICATE))).toBe('conflict')
  })

  it('reads an address that joined in the meantime as a conflict', () => {
    expect(classifyInvitationFailure(new Error('The address belongs to a member already (aborted)\nOnly an administrator can invite people (aborted)'))).toBe('conflict')
  })

  it('reads a team that filled up in the meantime as full', () => {
    expect(classifyInvitationFailure(new Error('The team is full (aborted)\nOnly an administrator can invite people (aborted)'))).toBe('full')
  })

  it('reads an inviter who lost the right to invite as forbidden', () => {
    expect(classifyInvitationFailure(new Error(NOT_ADMINISTRATOR))).toBe('forbidden')
    expect(classifyInvitationFailure(new Error('Only a member of an organization can invite people to it (aborted)'))).toBe('forbidden')
  })

  it('reads anything else as an error', () => {
    expect(classifyInvitationFailure(new Error('violates SQL foreign key constraint: organization_invitation_invited_by_id_fkey\nOnly an administrator can invite people (aborted)'))).toBe('error')
    expect(classifyInvitationFailure(new Error('fetch failed'))).toBe('error')
    expect(classifyInvitationFailure('timeout')).toBe('error')
  })
})
