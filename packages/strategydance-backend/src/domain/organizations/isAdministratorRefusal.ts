// How the backend connector's checks word a caller who is not, or no longer, a member or an
// administrator of the organization a mutation acts on
const REFUSAL_PATTERN = /^Only (an administrator|a member of an organization) can /i

/*
  Whether a mutation run for an administrator was refused because they no longer are one: demoted
  or removed between a route's early check and the mutation's own.

  Read off the first line of the message, as `classifyInvitationFailure` does, since the Admin SDK
  reports a failed `@check` as an error carrying the database's text, and the lines after the
  first list every other check of the rolled back transaction, failed or not
*/
function isAdministratorRefusal(error: unknown) {
  const [cause = ''] = (error instanceof Error ? error.message : String(error)).split('\n')

  return REFUSAL_PATTERN.test(cause)
}

export default isAdministratorRefusal
