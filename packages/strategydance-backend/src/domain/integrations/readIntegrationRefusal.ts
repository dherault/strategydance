import isAdministratorRefusal from '~domain/organizations/isAdministratorRefusal'

/*
  Why an integration's mutation refused, from the first line of the Admin SDK's message, which is the
  failed `@check`'s: the caller no longer administers the organization, the organization has as
  many servers as it may, another server has the name, the server was changed or deleted since it
  was read, it no longer lists the tool approved, or it is gone. Null for any other failure, which
  is the database's and thrown on
*/
function readIntegrationRefusal(error: unknown) {
  if (isAdministratorRefusal(error)) return 'forbidden'

  const [cause = ''] = (error instanceof Error ? error.message : String(error)).split('\n')

  if (cause.includes('An organization adds at most 50 servers')) return 'full'
  if (cause.includes('Another server of the organization has this name')) return 'nameTaken'
  if (cause.includes('The server was changed or deleted meanwhile')) return 'conflict'
  if (cause.includes('The server no longer lists this tool')) return 'toolGone'
  if (cause.includes('The server is gone')) return 'gone'

  return null
}

type IntegrationRefusal = NonNullable<ReturnType<typeof readIntegrationRefusal>>

export { type IntegrationRefusal }

export default readIntegrationRefusal
