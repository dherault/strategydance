import { MAX_TEAM_SIZE } from 'strategydance-core'
import { createOrganizationInvitation, getOrganizationInvitationContext, OrganizationRole } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import sendOrganizationInvitationEmail from '~domain/email/sendOrganizationInvitationEmail'
import classifyInvitationFailure from '~domain/organizations/classifyInvitationFailure'

type CreateOrganizationInvitationsInput = {
  organizationId: string
  inviterId: string
  // Normalized and deduplicated by the route's schema
  emails: string[]
}

type CreateOrganizationInvitationsResult =
  | { outcome: 'forbidden' }
  | { outcome: 'conflict', memberEmails: string[], invitedEmails: string[] }
  | { outcome: 'full', room: number }
  | { outcome: 'created', invitedEmails: string[], failedEmails: string[] }

/*
  Invites a list of addresses to an organization and emails each one its link.

  One read first says whether the inviter may, whether any address already belongs to a member or
  has a pending invitation, and whether the team has room for them all; any of those refuses the
  whole list, since the form that sent it checks the same things and a list that fails here is
  one the reader has not seen yet.

  Then one insert per address, in parallel, each checking again in its own transaction. One can
  still fail on its own, when somebody else invited the address or it joined in between, so the
  answer says which went out rather than failing them all. Only the ones that were created are
  emailed, whatever happened to the others.

  Any other refusal is not the address's doing and is not reported as if it were: a team that
  filled up in between answers full, an inviter who stopped being an administrator in between
  answers forbidden, and an outage fails the request
*/
async function createOrganizationInvitations({ organizationId, inviterId, emails }: CreateOrganizationInvitationsInput): Promise<CreateOrganizationInvitationsResult> {
  const { data: context } = await getOrganizationInvitationContext(dataConnect, {
    organizationId,
    userId: inviterId,
  })

  const inviter = context.userOrganization

  if (inviter?.role !== OrganizationRole.ADMINISTRATOR) return { outcome: 'forbidden' }

  const teamMemberEmails = new Set(context.userOrganizations.map(({ user }) => user.email))
  const teamInvitedEmails = new Set(context.organizationInvitations.map(({ email }) => email))
  const memberEmails = emails.filter(email => teamMemberEmails.has(email))
  const alreadyInvitedEmails = emails.filter(email => teamInvitedEmails.has(email))

  if (memberEmails.length || alreadyInvitedEmails.length) {
    return {
      outcome: 'conflict',
      memberEmails,
      invitedEmails: alreadyInvitedEmails,
    }
  }

  const room = Math.max(0, MAX_TEAM_SIZE - teamMemberEmails.size - teamInvitedEmails.size)

  if (emails.length > room) return { outcome: 'full', room }

  const results = await Promise.allSettled(emails.map(email => createOrganizationInvitation(dataConnect, {
    organizationId,
    userId: inviterId,
    email,
  })))

  const invitations: { id: string, email: string }[] = []
  const failedEmails: string[] = []
  const errors: unknown[] = []
  let isFull = false
  let isForbidden = false

  results.forEach((result, index) => {
    const email = emails[index]

    if (result.status === 'fulfilled') {
      invitations.push({ id: result.value.data.organizationInvitation_insert.id, email })

      return
    }

    const failure = classifyInvitationFailure(result.reason)

    if (failure === 'conflict') {
      logger.warn(`Invitations: ${email} was invited to ${organizationId} or joined it in the meantime`, result.reason)
      failedEmails.push(email)
    }
    else if (failure === 'full') {
      isFull = true
    }
    else if (failure === 'forbidden') {
      isForbidden = true
    }
    else {
      errors.push(result.reason)
    }
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

  if (errors.length) throw new AggregateError(errors, `Could not create ${errors.length} of ${emails.length} invitations to ${organizationId}`)
  if (isForbidden) return { outcome: 'forbidden' }
  if (isFull) return { outcome: 'full', room: 0 }

  return {
    outcome: 'created',
    invitedEmails: invitations.map(({ email }) => email),
    failedEmails,
  }
}

export default createOrganizationInvitations
