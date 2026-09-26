import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'

// What each collaborator answers, set per test
let claimed = 1
let recipient: { email: string, displayName: string | null } | null = { email: 'astrid@example.com', displayName: 'Astrid Lindqvist' }
let sendFailures: { index: number, message: string }[] = []
let completionFailures = 0

const completeWelcomeEmail = mock(async () => {
  if (completionFailures-- > 0) throw new Error('Data Connect is unavailable')

  return { data: { user_update: { id: 'user-1' } } }
})

const sendEmails = mock(async () => sendFailures)

const renderWelcomeEmail = mock(async (props: { firstName: string | null, appUrl: string }) => ({
  senderName: 'David Hérault',
  subject: 'Welcome to Strategy Dance',
  html: `<p>Hi ${props.firstName}</p>`,
  text: `Hi ${props.firstName}`,
}))

mock.module('~constants', () => ({ APP_URL: 'http://localhost:5173' }))

mock.module('~firebase', () => ({ dataConnect: {} }))

mock.module('strategydance-database/backend', () => ({
  claimWelcomeEmail: async () => ({ data: { user_updateMany: claimed } }),
  getWelcomeEmailRecipient: async () => ({ data: { user: recipient } }),
  completeWelcomeEmail,
}))

mock.module('strategydance-emails', () => ({ renderWelcomeEmail }))

mock.module('~domain/email/sendEmails', () => ({ default: sendEmails }))

// The waits between completion attempts, skipped
spyOn(Bun, 'sleep').mockResolvedValue(undefined)

const { default: sendWelcomeEmail } = await import('./sendWelcomeEmail')

beforeEach(() => {
  claimed = 1
  recipient = { email: 'astrid@example.com', displayName: 'Astrid Lindqvist' }
  sendFailures = []
  completionFailures = 0
  completeWelcomeEmail.mockClear()
  sendEmails.mockClear()
  renderWelcomeEmail.mockClear()
})

describe('sendWelcomeEmail', () => {
  test('sends nothing when another request holds the claim, or the welcome went out already', async () => {
    claimed = 0

    await sendWelcomeEmail('user-1')

    expect(sendEmails).not.toHaveBeenCalled()
    expect(completeWelcomeEmail).not.toHaveBeenCalled()
  })

  test('sends the welcome to the account, by first name and under its key, then records it', async () => {
    await sendWelcomeEmail('user-1')

    expect(renderWelcomeEmail).toHaveBeenCalledWith({ firstName: 'Astrid', appUrl: 'http://localhost:5173' })
    expect(sendEmails).toHaveBeenCalledTimes(1)
    expect(sendEmails.mock.calls[0]).toEqual([[expect.objectContaining({ to: 'astrid@example.com' })], 'welcome/user-1'] as never)
    expect(completeWelcomeEmail).toHaveBeenCalledTimes(1)
  })

  test('greets an account with no name without one', async () => {
    recipient = { email: 'astrid@example.com', displayName: '  ' }

    await sendWelcomeEmail('user-1')

    expect(renderWelcomeEmail).toHaveBeenCalledWith({ firstName: null, appUrl: 'http://localhost:5173' })
  })

  test('throws without recording it when Resend refuses the email, so the lease lapses', async () => {
    sendFailures = [{ index: 0, message: 'Invalid `to` field' }]

    await expect(sendWelcomeEmail('user-1')).rejects.toThrow('Invalid `to` field')
    expect(completeWelcomeEmail).not.toHaveBeenCalled()
  })

  test('tries recording it again when that fails, and throws once it has failed every time', async () => {
    completionFailures = 2

    await sendWelcomeEmail('user-1')

    expect(completeWelcomeEmail).toHaveBeenCalledTimes(3)

    completeWelcomeEmail.mockClear()
    completionFailures = 3

    await expect(sendWelcomeEmail('user-1')).rejects.toThrow('Data Connect is unavailable')
    expect(completeWelcomeEmail).toHaveBeenCalledTimes(3)
  })

  test('throws when the claimed account has no row to read', async () => {
    recipient = null

    await expect(sendWelcomeEmail('user-1')).rejects.toThrow('No user user-1')
    expect(sendEmails).not.toHaveBeenCalled()
  })
})
