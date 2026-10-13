import isAdministratorRefusal from '~domain/organizations/isAdministratorRefusal'

// The constraints a member's connection and Connect reference the membership by, which Data Connect
// reports before a step's own check when the member was removed meanwhile
const MEMBERSHIP_CONSTRAINTS = ['integration_connection_membership_fkey', 'integration_authorization_membership_fkey']

/*
  Why an integration's mutation refused, from the first line of the Admin SDK's message, which is the
  failed `@check`'s: the caller no longer administers the organization, or is no longer its member,
  the organization has as many servers as it may, another server has the name, the server was
  changed or deleted since it was read, it no longer lists the tool approved, it is gone, a member's
  sign-in was finished already or has expired, or a refresh lost its lease. Null for any other
  failure, which is the database's and thrown on
*/
function readIntegrationRefusal(error: unknown) {
  if (isAdministratorRefusal(error)) return 'forbidden'

  const message = error instanceof Error ? error.message : String(error)

  if (MEMBERSHIP_CONSTRAINTS.some(constraint => message.includes(constraint))) return 'forbidden'

  const [cause = ''] = message.split('\n')

  if (cause.includes('An organization adds at most 50 servers')) return 'full'
  if (cause.includes('Another server of the organization has this name')) return 'nameTaken'
  if (cause.includes('The server was changed or deleted meanwhile')) return 'conflict'
  if (cause.includes('The server no longer lists this tool')) return 'toolGone'
  if (cause.includes('The server is gone')) return 'gone'
  if (cause.includes('The sign-in was finished already or has expired')) return 'expired'
  if (cause.includes('The refresh lost its lease')) return 'leaseLost'

  return null
}

type IntegrationRefusal = NonNullable<ReturnType<typeof readIntegrationRefusal>>

export { type IntegrationRefusal }

export default readIntegrationRefusal
