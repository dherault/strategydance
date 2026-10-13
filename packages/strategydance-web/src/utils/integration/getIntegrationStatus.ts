import { IntegrationAuthentication, type IntegrationError } from 'strategydance-database/web'

type IntegrationStatusSource = {
  isEnabled: boolean
  authentication: IntegrationAuthentication
  toolCount?: number | null
  lastError?: IntegrationError | null
}

/*
  Where a server stands, as its badge says it: off when an administrator turned it off, whatever
  else holds; an error when it could not be reached the last time it was tried; needing
  authentication when it takes OAuth and no member has connected an account to list its tools yet
  (M28); connected otherwise
*/
function getIntegrationStatus({ isEnabled, authentication, toolCount, lastError }: IntegrationStatusSource) {
  if (!isEnabled) return 'off'
  if (lastError) return 'error'
  if (authentication === IntegrationAuthentication.OAUTH && (toolCount ?? null) === null) return 'needsAuthentication'

  return 'connected'
}

type IntegrationStatus = ReturnType<typeof getIntegrationStatus>

export { type IntegrationStatus }

export default getIntegrationStatus
