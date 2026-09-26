import { PRODUCT_NAME } from './constants'
import OrganizationInvitationEmail, { type OrganizationInvitationEmailProps } from './emails/OrganizationInvitationEmail'
import renderEmail from './renderEmail'

/*
  The inviter and the organization name are what the recipient knows, so they lead the subject.
  Both are user input: React escapes them in the HTML, and the subject travels to the provider as
  a JSON string rather than as a raw header
*/
async function renderOrganizationInvitationEmail(props: OrganizationInvitationEmailProps) {
  return {
    senderName: PRODUCT_NAME,
    subject: `${props.inviterName} invited you to join ${props.organizationName} on ${PRODUCT_NAME}`,
    ...await renderEmail(<OrganizationInvitationEmail {...props} />),
  }
}

export default renderOrganizationInvitationEmail
