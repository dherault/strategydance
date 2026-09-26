import { claimWelcomeEmail, completeWelcomeEmail, getWelcomeEmailRecipient } from 'strategydance-database/backend'
import { renderWelcomeEmail } from 'strategydance-emails'

import { APP_URL } from '~constants'

import { dataConnect } from '~firebase'

import sendEmails from '~domain/email/sendEmails'

/*
  Sends an account its one welcome email, and does nothing for an account that already had it or
  whose welcome another request is sending.

  The rule lives here rather than with the caller, so whatever asks for a welcome cannot get it
  wrong. The email is claimed before it is sent, never after: two requests landing together would
  otherwise both find it unsent and both mail. The claim is a lease: a send that fails, or a
  process that dies mid-send, leaves it to lapse after ten minutes, and the next request retries.

  Resend's idempotency key covers the one gap left, a send that went out and a completion that did
  not land: the retry it causes within 24 hours is dropped rather than mailed again
*/
async function sendWelcomeEmail(userId: string) {
  const { data: { user_updateMany: claimed } } = await claimWelcomeEmail(dataConnect, { userId })

  if (!claimed) return

  const { data: { user } } = await getWelcomeEmailRecipient(dataConnect, { userId })

  if (!user) throw new Error(`No user ${userId} to welcome, though its welcome email was just claimed`)

  const email = await renderWelcomeEmail({
    // The first word of the account's name: "Hi Astrid" rather than "Hi Astrid Lindqvist"
    firstName: user.displayName?.trim().split(/\s+/)[0] || null,
    appUrl: APP_URL,
  })

  const [failure] = await sendEmails([{ ...email, to: user.email }], `welcome/${userId}`)

  if (failure) throw new Error(`Resend refused ${userId}'s welcome email: ${failure.message}`)

  await completeWelcomeEmail(dataConnect, { userId })
}

export default sendWelcomeEmail
