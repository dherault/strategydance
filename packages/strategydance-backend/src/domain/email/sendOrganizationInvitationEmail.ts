import { renderOrganizationInvitationEmail } from 'strategydance-emails'

import { APP_URL, IS_PRODUCTION } from '~constants'

import logger from '~utils/logger'

import sendEmail from '~domain/email/sendEmail'

type OrganizationInvitationEmail = {
  to: string
  invitationId: string
  organizationName: string
  inviterName: string
}

/*
  Emails an invitation its link.

  Outside production `sendEmail` writes the email to a file rather than sending it, and the link is
  logged as well, which is how an invitation gets accepted locally: open it from the backend's
  output. Production never logs it, because it is a secret and Cloud Logging is read by more people
  than the invitee
*/
async function sendOrganizationInvitationEmail({ to, invitationId, organizationName, inviterName }: OrganizationInvitationEmail) {
  // The page that accepts it
  const invitationUrl = `${APP_URL}/-/invitation/${invitationId}`

  const email = await renderOrganizationInvitationEmail({
    organizationName,
    inviterName,
    invitationUrl,
  })

  await sendEmail({
    ...email,
    to,
    idempotencyKey: `invitation/${invitationId}`,
  })

  if (!IS_PRODUCTION) logger.info(`📨 ${inviterName}'s invitation to join ${organizationName}, for ${to}: ${invitationUrl}`)
}

export default sendOrganizationInvitationEmail
