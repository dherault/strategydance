import { defineMessages } from 'react-intl'

// The page an invitation's link opens, where the invitee joins the organization or declines
const invitationMessages = defineMessages({
  eyebrow: {
    id: 'invitation.eyebrow',
    defaultMessage: 'Invitation',
    description: 'Small label above the title of the page an invitation link opens.',
  },
  title: {
    id: 'invitation.title',
    defaultMessage: 'Join {organizationName}',
    description: 'Title of the page an invitation link opens, naming the organization the reader is invited to.',
  },
  lead: {
    id: 'invitation.lead',
    defaultMessage: '{inviterName} invited you to join {organizationName} as a member.',
    description: 'Explanation under the title of the invitation page, naming who sent the invitation.',
  },
  join: {
    id: 'invitation.join',
    defaultMessage: 'Join',
    description: 'Button that accepts the invitation and joins the organization.',
  },
  decline: {
    id: 'invitation.decline',
    defaultMessage: 'Decline',
    description: 'Button that refuses the invitation. It asks to be clicked a second time.',
  },
  declineConfirm: {
    id: 'invitation.declineConfirm',
    defaultMessage: 'Confirm?',
    description: 'What the decline button says after its first click, asking to be clicked again to go ahead.',
  },
  joined: {
    id: 'invitation.joined',
    defaultMessage: 'You joined {organizationName}',
    description: 'Confirmation shown after the reader accepted an invitation.',
  },
  declined: {
    id: 'invitation.declined',
    defaultMessage: 'Invitation declined',
    description: 'Confirmation shown after the reader refused an invitation.',
  },
  joinError: {
    id: 'invitation.joinError',
    defaultMessage: 'Joining {organizationName} did not go through. Reload the page to see where it stands.',
    description: 'Error shown when accepting an invitation failed, or succeeded but could not be confirmed. Reloading shows either the invitation again or the organization joined.',
  },
  declineError: {
    id: 'invitation.declineError',
    defaultMessage: 'The invitation could not be declined. Try again.',
    description: 'Error shown when refusing an invitation failed.',
  },
  missingTitle: {
    id: 'invitation.missingTitle',
    defaultMessage: 'Invitation unavailable',
    description: 'Title of the invitation page when the invitation cannot be found for the signed-in reader.',
  },
  missingLead: {
    id: 'invitation.missingLead',
    defaultMessage: 'It was canceled or answered already, or it was sent to another address than {email}. Ask whoever invited you to send a new one, or sign in with the address it was sent to.',
    description: 'Explanation on the invitation page when the invitation cannot be found for the signed-in reader, naming the address they are signed in with.',
  },
  loadError: {
    id: 'invitation.loadError',
    defaultMessage: 'The invitation could not be loaded. Check your connection and try again.',
    description: 'Error on the invitation page when reading the invitation failed, as opposed to the invitation being gone.',
  },
  retry: {
    id: 'invitation.retry',
    defaultMessage: 'Try again',
    description: 'Button that reads the invitation again after it failed to load.',
  },
  continue: {
    id: 'invitation.continue',
    defaultMessage: 'Continue to Strategy Dance',
    description: 'Button on the unavailable invitation page that leads into the app. Strategy Dance is the product name and stays untranslated.',
  },
  unverifiedTitle: {
    id: 'invitation.unverifiedTitle',
    defaultMessage: 'Confirm your email address',
    description: 'Title of the invitation page when the signed-in reader has not confirmed their email address yet, which opening an invitation requires.',
  },
  unverifiedLead: {
    id: 'invitation.unverifiedLead',
    defaultMessage: 'Invitations open only for a confirmed address. We will send a confirmation link to {email}. Open it, and it brings you back here.',
    description: 'Explanation on the invitation page for a reader whose email address is not confirmed yet, naming the address the link is sent to.',
  },
  sendConfirmation: {
    id: 'invitation.sendConfirmation',
    defaultMessage: 'Send the link',
    description: 'Button that emails the reader a link confirming their email address.',
  },
  resendConfirmation: {
    id: 'invitation.resendConfirmation',
    defaultMessage: 'Send it again',
    description: 'Button that emails the confirmation link once more, after it was sent already.',
  },
  confirmationSent: {
    id: 'invitation.confirmationSent',
    defaultMessage: 'Link sent to {email}. Open it, or come back to this tab once you have.',
    description: 'Notice shown after the confirmation link was emailed, naming the address it went to.',
  },
  checkConfirmation: {
    id: 'invitation.checkConfirmation',
    defaultMessage: 'I confirmed it',
    description: 'Button the reader presses after opening the confirmation link, which checks that their address is now confirmed.',
  },
  notConfirmed: {
    id: 'invitation.notConfirmed',
    defaultMessage: '{email} is not confirmed yet. Open the link in the email we sent, or send it again.',
    description: 'Notice shown when the reader said they confirmed their address but it is still unconfirmed, naming the address.',
  },
  confirmationError: {
    id: 'invitation.confirmationError',
    defaultMessage: 'That did not go through. Check your connection and try again in a moment.',
    description: 'Error shown when sending the confirmation link, or checking whether the address is confirmed, failed.',
  },
})

export default invitationMessages
