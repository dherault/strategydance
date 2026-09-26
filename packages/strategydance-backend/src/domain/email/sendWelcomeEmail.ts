import { claimWelcomeEmail, getWelcomeEmailRecipient, releaseWelcomeEmail } from 'strategydance-database/backend'
import { renderWelcomeEmail } from 'strategydance-emails'

import { APP_URL } from '~constants'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import sendEmails from '~domain/email/sendEmails'

/*
  Sends an account its one welcome email, and does nothing for an account that already had it.

  The latch lives here rather than with the caller, so whatever asks for a welcome later cannot get
  the rule wrong. It is claimed before sending, never after: two requests landing together would
  otherwise both find it empty and both mail. And it is handed back when anything after the claim
  fails, so the column means the email went out rather than that somebody tried
*/
async function sendWelcomeEmail(userId: string) {
  const { data: { user_updateMany: claimed } } = await claimWelcomeEmail(dataConnect, { userId })

  if (!claimed) return

  try {
    const { data: { user } } = await getWelcomeEmailRecipient(dataConnect, { userId })

    if (!user) throw new Error(`No user ${userId} to welcome, though its welcome email was just claimed`)

    const email = await renderWelcomeEmail({
      // The first word of the account's name: "Hi Astrid" rather than "Hi Astrid Lindqvist"
      firstName: user.displayName?.trim().split(/\s+/)[0] || null,
      appUrl: APP_URL,
    })

    const [failure] = await sendEmails([{ ...email, to: user.email }], `welcome/${userId}`)

    if (failure) throw new Error(`Resend refused ${userId}'s welcome email: ${failure.message}`)
  }
  catch (error) {
    // Logged rather than thrown if it fails in turn, so the caller hears about the send, which is
    // what went wrong first
    await releaseWelcomeEmail(dataConnect, { userId }).catch(releaseError => {
      logger.error(`Welcome email: could not hand back ${userId}'s claim, so it will not be retried`, releaseError)
    })

    throw error
  }
}

export default sendWelcomeEmail
