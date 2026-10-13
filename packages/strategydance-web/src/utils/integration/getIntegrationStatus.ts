import {
  IntegrationAuthentication,
  IntegrationConnectionStatus,
  type IntegrationError,
} from 'strategydance-database/web'

type IntegrationStatusSource = {
  isEnabled: boolean
  authentication: IntegrationAuthentication
  lastError?: IntegrationError | null
}

/*
  Where a server stands for the reader, as its badge says it: off when an administrator turned it
  off, whatever else holds; an error when it could not be reached the last time it was tried; needing
  authentication when it takes OAuth and the reader's own account is not connected to it, or no
  longer taken; connected otherwise. An OAuth server works for each member through their own
  account, so two members can read two statuses of one server
*/
function getIntegrationStatus(
  { isEnabled, authentication, lastError }: IntegrationStatusSource,
  connection: { status: IntegrationConnectionStatus } | null = null,
) {
  if (!isEnabled) return 'off'
  if (lastError) return 'error'

  const isConnected = connection?.status === IntegrationConnectionStatus.CONNECTED

  if (authentication === IntegrationAuthentication.OAUTH && !isConnected) return 'needsAuthentication'

  return 'connected'
}

type IntegrationStatus = ReturnType<typeof getIntegrationStatus>

export { type IntegrationStatus }

export default getIntegrationStatus
