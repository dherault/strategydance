import { type InviteOrganizationMembersData, MAX_TEAM_SIZE } from 'strategydance-core'
import { createOrganizationInvitation, getOrganizationInvitationContext, OrganizationRole } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import sendOrganizationInvitationEmails from '~domain/email/sendOrganizationInvitationEmails'
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
  | ({ outcome: 'created' } & InviteOrganizationMembersData)

/*
  Invites a list of addresses to an organization and emails each one its link.

  One read first says whether the inviter may, whether any address already belongs to a member or
  has a pending invitation, and whether the team has room for them all; any of those refuses the
  whole list, since the form that sent it checks the same things and a list that fails here is
  one the reader has not seen yet.

  Then one insert per address, in parallel, each checking again in its own transaction, so each can
  fail on its own: the address taken in between, the team filled up, the inviter no longer an
  administrator, or an outage. The ones that were created are emailed whatever happened to the
  others. When any went out, the answer lists them and every address that did not with its
  reason, so the reader knows what exists and a retry does not trip over it. When none did, the
  worst reason answers for the whole request: an outage fails it, then forbidden, then full, and
  addresses that were only taken are listed as such
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
  const failedEmails: InviteOrganizationMembersData['failedEmails'] = []
  const errors: unknown[] = []

  results.forEach((result, index) => {
    const email = emails[index]

    if (result.status === 'fulfilled') {
      invitations.push({ id: result.value.data.organizationInvitation_insert.id, email })

      return
    }

    const reason = classifyInvitationFailure(result.reason)

    failedEmails.push({ email, reason })

    if (reason === 'error') errors.push(result.reason)
    else logger.warn(`Invitations: could not invite ${email} to ${organizationId} (${reason})`, result.reason)
  })

  /*
    An invitation whose email failed still exists, and the team page lists it, so an administrator
    can cancel it and invite again. The failure is logged rather than reported as a failed invite
  */
  try {
    const emailFailures = await sendOrganizationInvitationEmails({
      invitations,
      organizationName: inviter.organization.name,
      inviterName: inviter.user.displayName || inviter.user.email,
    })

    emailFailures.forEach(({ email, message }) => logger.error(`Invitations: could not email ${email}`, message))
  }
  catch (error) {
    logger.error(`Invitations: could not email ${invitations.length} invitations to ${organizationId}`, error)
  }

  errors.forEach(error => logger.error(`Invitations: could not create an invitation to ${organizationId}`, error))

  if (!invitations.length) {
    const reasons = new Set(failedEmails.map(({ reason }) => reason))

    if (reasons.has('error')) throw new AggregateError(errors, `Could not create ${errors.length} of ${emails.length} invitations to ${organizationId}`)
    if (reasons.has('forbidden')) return { outcome: 'forbidden' }
    if (reasons.has('full')) return { outcome: 'full', room: 0 }
  }

  return {
    outcome: 'created',
    invitedEmails: invitations.map(({ email }) => email),
    failedEmails,
  }
}

export default createOrganizationInvitations
