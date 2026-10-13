import { forgetOrganizationIntegrationOAuthClient } from 'strategydance-database/backend'

import { INTEGRATION_OAUTH_CLIENT_ID } from '~constants'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

/*
  Forgets the client a server's authorization server answered as unknown or no longer taken, so the
  next Connect registers again rather than every member staying stuck on it until an administrator
  reconfigures the server. Matched on its id, so a client recorded meanwhile stays; Strategy Dance's
  client ID metadata document is no registration, and stays. The connections issued to it are left
  as they are: each one's next refresh presents the client, which the server refuses as it did this
  one, and marks it as needing its member. Best effort: a failure is logged
*/
async function forgetRefusedIntegrationClient(
  caller: { organizationId: string; userId: string; integrationId: string },
  oauthClientId: string,
) {
  if (oauthClientId === INTEGRATION_OAUTH_CLIENT_ID) return

  try {
    await forgetOrganizationIntegrationOAuthClient(dataConnect, { ...caller, oauthClientId })
  } catch (error) {
    logger.error('Integrations: a refused client could not be forgotten', error)
  }
}

export default forgetRefusedIntegrationClient
