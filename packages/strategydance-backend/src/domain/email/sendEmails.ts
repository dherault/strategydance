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
}

// An email Resend refused, by its index in the list it was handed
type EmailFailure = {
  index: number
  message: string
}

// The most emails Resend's batch endpoint takes in one request
const BATCH_SIZE = 100

// How many times a request refused for its rate is sent again, and the longest wait before one
const RATE_LIMIT_RETRIES = 3

const RATE_LIMIT_MAX_DELAY_MS = 10 * 1000

/*
  The one door every email goes through, so a new kind of email gets the development guard and the
  failure contract by construction. Answers with the emails Resend refused, and throws when it
  refused the request as a whole.

  One request per hundred emails, through Resend's batch endpoint, rather than one per email: an
  invite request carries up to fifty addresses, and fifty requests at once run into Resend's rate
  limit. `permissive` has Resend send the valid emails of a batch and list the others, rather than
  refusing all of them for one bad address. A request refused for its rate anyway, by a burst from
  several requests at once, is sent again after the wait Resend asks for.

  `idempotencyKey` has Resend drop a second request carrying it for 24 hours, so a retry cannot
  mail twice.

  Only production sends. Anywhere else the HTML is written to the OS temp directory and its path
  logged, to open in a browser: an emulator account carries whatever address somebody typed, and
  mail to it would be real. The temp directory rather than the repository, so no copy is ever staged
*/
async function sendEmails(emails: Email[], idempotencyKey: string): Promise<EmailFailure[]> {
  if (!IS_PRODUCTION) {
    await Promise.all(emails.map(async ({ to, subject, html }) => {
      const file = path.join(os.tmpdir(), `strategydance-email-${randomUUID()}.html`)

      await fs.writeFile(file, html, 'utf-8')

      logger.info(`📨 Would send "${subject}" to ${to}: file://${file}`)
    }))

    return []
  }

  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set, so no email can be sent')

  // Built per call rather than at module scope, where it would throw in development for want of a key
  const resend = new Resend(RESEND_API_KEY)

  const failures: EmailFailure[] = []

  for (let start = 0; start < emails.length; start += BATCH_SIZE) {
    const batch = emails.slice(start, start + BATCH_SIZE)

    const batchFailures = await sendBatch(resend, batch, `${idempotencyKey}/${start / BATCH_SIZE}`)

    failures.push(...batchFailures.map(({ index, message }) => ({ index: start + index, message })))
  }

  return failures
}

async function sendBatch(resend: Resend, emails: Email[], idempotencyKey: string) {
  const payload = emails.map(({ senderName, to, subject, html, text }) => ({
    from: `${senderName} <${EMAIL_SENDER_ADDRESS}>`,
    to,
    subject,
    html,
    text,
  }))

  for (let attempt = 0; ; attempt++) {
    const { data, error, headers } = await resend.batch.send(payload, {
      idempotencyKey,
      batchValidation: 'permissive',
    })

    if (data) return data.errors

    // The SDK resolves with a refusal rather than throwing it: an unverified domain, a spent quota,
    // a malformed request. Resolving quietly would report a delivery that never happened
    if (error.name !== 'rate_limit_exceeded' || attempt === RATE_LIMIT_RETRIES) {
      throw new Error(`Resend refused ${emails.length} emails, the first "${emails[0].subject}", with ${error.name}: ${error.message}`)
    }

    // A second when Resend does not say
    const retryAfterSeconds = Number(headers?.['retry-after'] ?? 1)
    const delayMs = Math.min(Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 1000, RATE_LIMIT_MAX_DELAY_MS)

    logger.warn(`Email: Resend limited the rate, trying again in ${delayMs}ms`)

    await Bun.sleep(delayMs)
  }
}

export default sendEmails
