import { beforeEach, describe, expect, mock, test } from 'bun:test'

type RenderProps = {
  organizationName: string
  inviterName: string
  invitationUrl: string
}

type SentEmail = {
  to: string
  html: string
}

// What Resend refuses, by index in the batch
let refusedIndexes: number[] = []

const renderOrganizationInvitationEmail = mock(async (props: RenderProps) => ({
  senderName: 'Strategy Dance',
  subject: `${props.inviterName} invited you`,
  // The link stands in for the markup, so a test can read which one each email carries
  html: props.invitationUrl,
  text: props.invitationUrl,
}))

const sendEmails = mock(async (emails: SentEmail[], _idempotencyKey: string) => refusedIndexes.map(index => ({ index, message: `Refused ${emails[index].to}` })))

mock.module('~constants', () => ({ APP_URL: 'http://localhost:5173', IS_PRODUCTION: true }))

mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

mock.module('strategydance-emails', () => ({ renderOrganizationInvitationEmail }))

mock.module('~domain/email/sendEmails', () => ({ default: sendEmails }))

const { default: sendOrganizationInvitationEmails } = await import('./sendOrganizationInvitationEmails')

const invitations = [
  { id: 'a1', email: 'ada@example.com' },
  { id: 'b2', email: 'grace@example.com' },
  { id: 'c3', email: 'hedy@example.com' },
]

beforeEach(() => {
  refusedIndexes = []
  renderOrganizationInvitationEmail.mockClear()
  sendEmails.mockClear()
})

describe('sendOrganizationInvitationEmails', () => {
  test('sends each invitation its own link, to its own address, in one batch', async () => {
    await sendOrganizationInvitationEmails({ invitations, organizationName: 'Northwind', inviterName: 'Astrid' })

    expect(sendEmails).toHaveBeenCalledTimes(1)

    const [emails] = sendEmails.mock.calls[0]

    expect(emails.map(({ to, html }) => [to, html])).toEqual([
      ['ada@example.com', 'http://localhost:5173/-/invitation/a1'],
      ['grace@example.com', 'http://localhost:5173/-/invitation/b2'],
      ['hedy@example.com', 'http://localhost:5173/-/invitation/c3'],
    ])
    expect(renderOrganizationInvitationEmail.mock.calls[0][0]).toMatchObject({ organizationName: 'Northwind', inviterName: 'Astrid' })
  })

  test('keys the batch by the invitations it carries, the same every time and within Resend\'s length', async () => {
    await sendOrganizationInvitationEmails({ invitations, organizationName: 'Northwind', inviterName: 'Astrid' })
    await sendOrganizationInvitationEmails({ invitations, organizationName: 'Northwind', inviterName: 'Astrid' })
    await sendOrganizationInvitationEmails({ invitations: invitations.slice(1), organizationName: 'Northwind', inviterName: 'Astrid' })

    const [first, again, other] = sendEmails.mock.calls.map(([, key]) => key)

    expect(first).toMatch(/^invitations\/[0-9a-f]{64}$/)
    expect(again).toBe(first)
    expect(other).not.toBe(first)
  })

  test('answers with the invitations whose email Resend refused, matched by their place in the batch', async () => {
    refusedIndexes = [2, 0]

    const failures = await sendOrganizationInvitationEmails({ invitations, organizationName: 'Northwind', inviterName: 'Astrid' })

    expect(failures).toEqual([
      { id: 'c3', email: 'hedy@example.com', message: 'Refused hedy@example.com' },
      { id: 'a1', email: 'ada@example.com', message: 'Refused ada@example.com' },
    ])
  })

  test('sends nothing for no invitations', async () => {
    expect(await sendOrganizationInvitationEmails({ invitations: [], organizationName: 'Northwind', inviterName: 'Astrid' })).toEqual([])
    expect(sendEmails).not.toHaveBeenCalled()
  })
})
