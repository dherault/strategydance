import { type InviteOrganizationMembersData, MAX_TEAM_SIZE } from 'strategydance-core'
import { createOrganizationInvitation, deleteUnsentOrganizationInvitation, getOrganizationInvitationContext, OrganizationRole } from 'strategydance-database/backend'

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

/*
  How many invitations one person may send in an hour, whichever organizations they go to. Twice
  what fills a team, which only somebody sending to strangers needs more of. Every invitation is
  an email, so this is what bounds the mail one account can cause.

  Counted from the database rather than in this server's memory, which Cloud Run would multiply by
  its instances. Written out again in `GetOrganizationInvitationContext`'s limit and
  `CreateOrganizationInvitation`'s pruning, which cannot import it: change the three together
*/
const MAX_INVITATIONS_PER_HOUR = 200

const HOUR_MS = 60 * 60 * 1000

type CreateOrganizationInvitationsResult =
  | { outcome: 'forbidden' }
  | { outcome: 'quota', retryAfterMs: number }
  | { outcome: 'conflict', memberEmails: string[], invitedEmails: string[] }
  | { outcome: 'full', room: number }
  | ({ outcome: 'created' } & InviteOrganizationMembersData)

/*
  Invites a list of addresses to an organization and emails each one its link.

  One read first says whether the inviter may, whether they have sent too many invitations this
  hour, whether any address already belongs to a member or has a pending invitation, and whether
  the team has room for them all; any of those refuses the whole list, since the form that sent it
  checks the same things and a list that fails here is one the reader has not seen yet.

  The hourly count is read before the inserts rather than checked by each, so two requests from
  one person landing together can both fit under it and pass it by one request's worth. The
  per-instance request limit keeps that small, and the database still holds every team to its
  size.

  Then one insert per address, in parallel, each checking again in its own transaction, so each can
  fail on its own: the address taken in between, the team filled up, the inviter no longer an
  administrator, or an outage. The ones that were created are emailed whatever happened to the
  others, and one whose email did not go out is taken back and counts as an outage. When any went
  out, the answer lists them and every address that did not with its reason, so the reader knows
  what exists and a retry does not trip over it. When none did, the worst reason answers for the
  whole request: an outage fails it, then forbidden, then full, and addresses that were only
  taken are listed as such
*/
async function createOrganizationInvitations({ organizationId, inviterId, emails }: CreateOrganizationInvitationsInput): Promise<CreateOrganizationInvitationsResult> {
  const { data: context } = await getOrganizationInvitationContext(dataConnect, {
    organizationId,
    userId: inviterId,
  })

  const inviter = context.userOrganization

  if (inviter?.role !== OrganizationRole.ADMINISTRATOR) return { outcome: 'forbidden' }

  /*
    The sender's newest invitations from the last hour, read to the allowance. A request of n
    addresses fits once at most `MAX_INVITATIONS_PER_HOUR - n` of them are left in the hour, which
    is when the one after those, newest first, ages out. That holds however many there are past
    the allowance, which the race above can leave
  */
  const { sentInvitations } = context

  if (sentInvitations.length + emails.length > MAX_INVITATIONS_PER_HOUR) {
    return {
      outcome: 'quota',
      retryAfterMs: new Date(sentInvitations[MAX_INVITATIONS_PER_HOUR - emails.length].createdAt).getTime() + HOUR_MS - Date.now(),
    }
  }

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

    if (reason === 'error') {
      errors.push(result.reason)

      logger.error(`Invitations: could not create an invitation to ${organizationId}`, result.reason)
    }
    else {
      logger.warn(`Invitations: could not invite ${email} to ${organizationId} (${reason})`, result.reason)
    }
  })

  let unsentInvitations: { id: string, email: string, error: unknown }[]

  try {
    const emailFailures = await sendOrganizationInvitationEmails({
      invitations,
      organizationName: inviter.organization.name,
      inviterName: inviter.user.displayName || inviter.user.email,
    })

    unsentInvitations = emailFailures.map(({ id, email, message }) => ({ id, email, error: new Error(message) }))
  }
  catch (error) {
    unsentInvitations = invitations.map(({ id, email }) => ({ id, email, error }))
  }

  /*
    An invitation whose email did not go out is taken back rather than left pending: nobody has its
    link, which no member can read, and a pending row would keep its address from being invited
    again. It is reported as an outage, which tells the reader to try again. When taking it back
    fails too, it stays, and the team page lists it for an administrator to cancel
  */
  await Promise.all(unsentInvitations.map(async ({ id, email, error }) => {
    failedEmails.push({ email, reason: 'error' })
    errors.push(error)

    logger.error(`Invitations: could not email ${email}, so its invitation to ${organizationId} is taken back`, error)

    await deleteUnsentOrganizationInvitation(dataConnect, { id, organizationId }).catch(deleteError => {
      logger.error(`Invitations: could not take back the unsent invitation of ${email} to ${organizationId}, which stays pending`, deleteError)
    })
  }))

  const unsentIds = new Set(unsentInvitations.map(({ id }) => id))
  const deliveredInvitations = invitations.filter(({ id }) => !unsentIds.has(id))

  if (!deliveredInvitations.length) {
    const reasons = new Set(failedEmails.map(({ reason }) => reason))

    if (reasons.has('error')) throw new AggregateError(errors, `Could not invite ${errors.length} of ${emails.length} addresses to ${organizationId}`)
    if (reasons.has('forbidden')) return { outcome: 'forbidden' }
    if (reasons.has('full')) return { outcome: 'full', room: 0 }
  }

  return {
    outcome: 'created',
    invitedEmails: deliveredInvitations.map(({ email }) => email),
    failedEmails,
  }
}

export default createOrganizationInvitations
