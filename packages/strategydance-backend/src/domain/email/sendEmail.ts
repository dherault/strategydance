import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { Resend } from 'resend'

import { EMAIL_SENDER_ADDRESS, IS_PRODUCTION, RESEND_API_KEY } from '~constants'

import logger from '~utils/logger'

type Email = {
  // The name the email goes out under, which the email chooses. The address is always this server's
  senderName: string
  to: string
  subject: string
  // Rendered by strategydance-emails. Both parts go out: a message with no plain-text part scores
  // worse with spam filters
  html: string
  text: string
  // Resend drops a second send with the same key for 24 hours, so a retry cannot mail twice
  idempotencyKey: string
}

/*
  The one door every email goes through, so a new kind of email gets the development guard and the
  failure contract by construction.

  Only production sends. Anywhere else the HTML is written to the OS temp directory and its path
  logged, to open in a browser: an emulator account carries whatever address somebody typed, and
  mail to it would be real. The temp directory rather than the repository, so no copy is ever staged
*/
async function sendEmail({ senderName, to, subject, html, text, idempotencyKey }: Email) {
  if (!IS_PRODUCTION) {
    const file = path.join(os.tmpdir(), `strategydance-email-${randomUUID()}.html`)

    await fs.writeFile(file, html, 'utf-8')

    logger.info(`📨 Would send "${subject}" to ${to}: file://${file}`)

    return
  }

  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set, so no email can be sent')

  // Built per call rather than at module scope, where it would throw in development for want of a key
  const resend = new Resend(RESEND_API_KEY)

  const { error } = await resend.emails.send(
    {
      from: `${senderName} <${EMAIL_SENDER_ADDRESS}>`,
      to,
      subject,
      html,
      text,
    },
    { idempotencyKey },
  )

  // The SDK resolves with a refusal rather than throwing it: an unverified domain, a spent quota, a
  // malformed address. Resolving quietly would report a delivery that never happened
  if (error) throw new Error(`Resend refused "${subject}" with ${error.name}: ${error.message}`)
}

export default sendEmail
