import { createOrganizationInvitation, getOrganizationInvitationContext, OrganizationRole } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import sendOrganizationInvitationEmail from '~domain/email/sendOrganizationInvitationEmail'

type CreateOrganizationInvitationsInput = {
  organizationId: string
  inviterId: string
  // Normalized and deduplicated by the route's schema
  emails: string[]
}

type CreateOrganizationInvitationsResult =
  | { outcome: 'forbidden' }
  | { outcome: 'conflict', memberEmails: string[], invitedEmails: string[] }
  | { outcome: 'created', invitedEmails: string[], failedEmails: string[] }

/*
  Invites a list of addresses to an organization and emails each one its link.

  One read first says whether the inviter may, and whether any address already belongs to a
  member or has a pending invitation; any of those refuses the whole list, since the form that
  sent it checks the same things and a list that fails here is one the reader has not seen yet.

  Then one insert per address, in parallel, each checking again in its own transaction. One can
  still fail on its own, when somebody else invited the address in between, so the answer says
  which went out rather than failing them all. Only the ones that were created are emailed
*/
async function createOrganizationInvitations({ organizationId, inviterId, emails }: CreateOrganizationInvitationsInput): Promise<CreateOrganizationInvitationsResult> {
  const { data: context } = await getOrganizationInvitationContext(dataConnect, {
    organizationId,
    userId: inviterId,
    emails,
  })

  const inviter = context.userOrganization

  if (inviter?.role !== OrganizationRole.ADMINISTRATOR) return { outcome: 'forbidden' }

  const memberEmails = context.userOrganizations.map(({ user }) => user.email)
  const alreadyInvitedEmails = context.organizationInvitations.map(({ email }) => email)

  if (memberEmails.length || alreadyInvitedEmails.length) {
    return {
      outcome: 'conflict',
      memberEmails,
      invitedEmails: alreadyInvitedEmails,
    }
  }

  const results = await Promise.allSettled(emails.map(email => createOrganizationInvitation(dataConnect, {
    organizationId,
    userId: inviterId,
    email,
  })))

  const invitations: { id: string, email: string }[] = []
  const failedEmails: string[] = []

  results.forEach((result, index) => {
    const email = emails[index]

    if (result.status === 'fulfilled') {
      invitations.push({ id: result.value.data.organizationInvitation_insert.id, email })

      return
    }

    logger.warn(`Invitations: could not invite ${email} to ${organizationId}`, result.reason)
    failedEmails.push(email)
  })

  const emailResults = await Promise.allSettled(invitations.map(({ id, email }) => sendOrganizationInvitationEmail({
    to: email,
    invitationId: id,
    organizationName: inviter.organization.name,
    inviterName: inviter.user.displayName || inviter.user.email,
  })))

  /*
    An invitation whose email failed still exists, and the team page lists it, so an administrator
    can cancel it and invite again. The failure is logged rather than reported as a failed invite
  */
  emailResults.forEach((result, index) => {
    if (result.status === 'rejected') logger.error(`Invitations: could not email ${invitations[index].email}`, result.reason)
  })

  return {
    outcome: 'created',
    invitedEmails: invitations.map(({ email }) => email),
    failedEmails,
  }
}

export default createOrganizationInvitations
