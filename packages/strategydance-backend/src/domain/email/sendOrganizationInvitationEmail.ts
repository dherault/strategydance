import { APP_URL, IS_PRODUCTION } from '~constants'

import logger from '~utils/logger'

type OrganizationInvitationEmail = {
  to: string
  invitationId: string
  organizationName: string
  inviterName: string
}

/*
  PLACEHOLDER: nothing is sent yet. Resend and a react-email template replace this body, and the
  signature stays.

  Until then it logs the email it would send. In development that includes the link, which is how
  an invitation gets accepted locally: open it from the backend's output. Production leaves the
  link out, because it is a secret and Cloud Logging is read by more people than the invitee
*/
async function sendOrganizationInvitationEmail({ to, invitationId, organizationName, inviterName }: OrganizationInvitationEmail) {
  // The page that accepts it
  const link = `${APP_URL}/-/invitation/${invitationId}`

  if (IS_PRODUCTION) {
    logger.warn(`📨 Not sending ${inviterName}'s invitation to ${organizationName}: email is not wired yet`)

    return
  }

  logger.info(`📨 Would send ${inviterName}'s invitation to join ${organizationName} to ${to}: ${link}`)
}

export default sendOrganizationInvitationEmail
