import { createHash } from 'node:crypto'

import { renderOrganizationInvitationEmail } from 'strategydance-emails'

import { APP_URL, IS_PRODUCTION } from '~constants'

import logger from '~utils/logger'

import sendEmails from '~domain/email/sendEmails'

type OrganizationInvitationEmails = {
  invitations: {
    id: string
    email: string
  }[]
  organizationName: string
  inviterName: string
}

/*
  Emails each invitation its link, in one request however many there are, and answers with the
  invitations whose email Resend refused.

  Outside production `sendEmails` writes the emails to files rather than sending them, and each link
  is logged as well, which is how an invitation gets accepted locally: open it from the backend's
  output. Production never logs one, because it is a secret and Cloud Logging is read by more
  people than the invitee
*/
async function sendOrganizationInvitationEmails({ invitations, organizationName, inviterName }: OrganizationInvitationEmails) {
  if (!invitations.length) return []

  const emails = await Promise.all(invitations.map(async ({ id, email }) => ({
    ...await renderOrganizationInvitationEmail({
      organizationName,
      inviterName,
      // The page that accepts it
      invitationUrl: `${APP_URL}/-/invitation/${id}`,
    }),
    to: email,
  })))

  // The invitations the request carries, which no other request does, hashed to fit the 256
  // characters Resend allows a key
  const idempotencyKey = `invitations/${createHash('sha256').update(invitations.map(({ id }) => id).join()).digest('hex')}`

  const failures = await sendEmails(emails, idempotencyKey)

  if (!IS_PRODUCTION) {
    invitations.forEach(({ id, email }) => {
      logger.info(`📨 ${inviterName}'s invitation to join ${organizationName}, for ${email}: ${APP_URL}/-/invitation/${id}`)
    })
  }

  return failures.map(({ index, message }) => ({
    ...invitations[index],
    message,
  }))
}

export default sendOrganizationInvitationEmails
