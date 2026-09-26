import type { InvitationFailureReason } from 'strategydance-core'

// The messages `CreateOrganizationInvitation`'s checks fail with, and the one Postgres gives a
// second row for the same organization and address
const TAKEN_PATTERN = /violates SQL unique constraint|belongs to a member already/i
const FULL_PATTERN = /The team is full/i
const FORBIDDEN_PATTERN = /Only an administrator can invite people|Only a member of an organization can invite people/i

/*
  Why one invitation's insert was refused: the address taken in the meantime, by an invitation or
  a membership; the team filling up in the meantime; the inviter losing the right to invite in
  the meantime; or anything else, which is an outage.

  Read off the message, since the Admin SDK reports a failed `@check` and a constraint violation
  alike, as an error carrying the database's text. Only its first line says what failed: the
  lines after it list the transaction's other `@check` messages, each marked `(aborted)`, whether
  or not they failed, so a duplicate address also carries the inviter checks' messages
*/
function classifyInvitationFailure(error: unknown): InvitationFailureReason {
  const [cause = ''] = (error instanceof Error ? error.message : String(error)).split('\n')

  if (FORBIDDEN_PATTERN.test(cause)) return 'forbidden'
  if (FULL_PATTERN.test(cause)) return 'full'
  if (TAKEN_PATTERN.test(cause)) return 'taken'

  return 'error'
}

export default classifyInvitationFailure
