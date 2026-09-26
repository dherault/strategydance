import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'

const NOW = Date.parse('2026-09-26T10:00:00Z')

const HOUR_MS = 60 * 60 * 1000

type Context = {
  userOrganization: { role: string, user: { displayName: string | null, email: string }, organization: { name: string } } | null
  userOrganizations: { user: { email: string } }[]
  organizationInvitations: { email: string }[]
  sentInvitations: { createdAt: string }[]
}

let context: Context

// Newest first, as `GetOrganizationInvitationContext` reads them: one every ten seconds going back
function sentInvitations(count: number) {
  return Array.from({ length: count }, (_, index) => ({ createdAt: new Date(NOW - index * 10 * 1000).toISOString() }))
}

function addresses(count: number) {
  return Array.from({ length: count }, (_, index) => `person${index}@example.com`)
}

const createOrganizationInvitation = mock(async (_dataConnect: unknown, { email }: { email: string }) => ({
  data: { organizationInvitation_insert: { id: `invitation-${email}` } },
}))

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

// The invitations whose email Resend refuses, `throw` for a batch it refuses whole, or `unknown`
// for one it never answers
let emailOutcome: string[] | 'throw' | 'unknown' = []

const deleteUnsentOrganizationInvitation = mock(async () => ({ data: { organizationInvitation_deleteMany: 1 } }))

mock.module('~domain/email/sendOrganizationInvitationEmails', () => ({
  default: async ({ invitations }: { invitations: { id: string, email: string }[] }) => {
    if (emailOutcome === 'throw') throw new Error('Resend refused them')
    if (emailOutcome === 'unknown') throw new UnknownDeliveryError('Resend never answered')

    const refused = emailOutcome

    return invitations.filter(({ email }) => refused.includes(email)).map(invitation => ({ ...invitation, message: 'Invalid `to` field' }))
  },
}))

mock.module('strategydance-database/backend', () => ({
  OrganizationRole: { MEMBER: 'MEMBER', ADMINISTRATOR: 'ADMINISTRATOR' },
  getOrganizationInvitationContext: async () => ({ data: context }),
  createOrganizationInvitation,
  deleteUnsentOrganizationInvitation,
}))

spyOn(Date, 'now').mockReturnValue(NOW)

const { default: createOrganizationInvitations } = await import('./createOrganizationInvitations')

const { default: UnknownDeliveryError } = await import('~domain/email/UnknownDeliveryError')

beforeEach(() => {
  context = {
    userOrganization: { role: 'ADMINISTRATOR', user: { displayName: 'Astrid', email: 'astrid@example.com' }, organization: { name: 'Northwind' } },
    userOrganizations: [{ user: { email: 'astrid@example.com' } }],
    organizationInvitations: [],
    sentInvitations: [],
  }
  createOrganizationInvitation.mockClear()
  deleteUnsentOrganizationInvitation.mockClear()
  emailOutcome = []
})

describe('createOrganizationInvitations', () => {
  test('refuses somebody who is not an administrator', async () => {
    context.userOrganization!.role = 'MEMBER'

    expect(await createOrganizationInvitations({ organizationId: 'org', inviterId: 'user', emails: addresses(1) })).toEqual({ outcome: 'forbidden' })
  })

  test('invites up to the hourly allowance exactly', async () => {
    context.sentInvitations = sentInvitations(199)

    const result = await createOrganizationInvitations({ organizationId: 'org', inviterId: 'user', emails: addresses(1) })

    expect(result.outcome).toBe('created')
    expect(createOrganizationInvitation).toHaveBeenCalledTimes(1)
  })

  test('takes back an invitation whose email Resend refused, and reports it as failed', async () => {
    emailOutcome = ['person1@example.com']

    const result = await createOrganizationInvitations({ organizationId: 'org', inviterId: 'user', emails: addresses(2) })

    expect(result).toEqual({
      outcome: 'created',
      invitedEmails: ['person0@example.com'],
      failedEmails: [{ email: 'person1@example.com', reason: 'error' }],
    })
    expect(deleteUnsentOrganizationInvitation).toHaveBeenCalledTimes(1)
    expect(deleteUnsentOrganizationInvitation.mock.calls[0]).toEqual([{}, { id: 'invitation-person1@example.com', organizationId: 'org' }] as never)
  })

  test('takes back every invitation and fails the request when no email went out', async () => {
    emailOutcome = 'throw'

    await expect(createOrganizationInvitations({ organizationId: 'org', inviterId: 'user', emails: addresses(2) })).rejects.toThrow('Could not invite 2 of 2')
    expect(deleteUnsentOrganizationInvitation).toHaveBeenCalledTimes(2)
  })

  test('keeps the invitations, as invited, when Resend never said whether it sent them', async () => {
    emailOutcome = 'unknown'

    const result = await createOrganizationInvitations({ organizationId: 'org', inviterId: 'user', emails: addresses(2) })

    expect(result).toEqual({
      outcome: 'created',
      invitedEmails: addresses(2),
      failedEmails: [],
    })
    expect(deleteUnsentOrganizationInvitation).not.toHaveBeenCalled()
  })

  test('refuses past the allowance until enough of the hour has aged out for the whole request', async () => {
    context.sentInvitations = sentInvitations(199)

    const result = await createOrganizationInvitations({ organizationId: 'org', inviterId: 'user', emails: addresses(2) })

    // Two fit once 198 are left: when the 199th newest, the oldest, ages out
    expect(result).toEqual({ outcome: 'quota', retryAfterMs: HOUR_MS - 198 * 10 * 1000 })
    expect(createOrganizationInvitation).not.toHaveBeenCalled()
  })

  test('waits for the right invitation when a race has left more than the allowance', async () => {
    // As many as the query reads, standing for 250 in the hour
    context.sentInvitations = sentInvitations(200)

    const result = await createOrganizationInvitations({ organizationId: 'org', inviterId: 'user', emails: addresses(50) })

    // Fifty fit once 150 are left: when the 151st newest ages out, however many are older
    expect(result).toEqual({ outcome: 'quota', retryAfterMs: HOUR_MS - 150 * 10 * 1000 })
  })
})
