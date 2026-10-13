import { IntegrationAuthentication } from 'strategydance-database/web'

import integrationMessages from '~data/intl/messages/integration'

const AUTHENTICATION_MESSAGES = {
  [IntegrationAuthentication.OAUTH]: integrationMessages.authenticationOAuth,
  [IntegrationAuthentication.API_KEY]: integrationMessages.authenticationApiKey,
  [IntegrationAuthentication.NONE]: integrationMessages.authenticationNone,
}

// How a server lets Strategy Dance in, as the table, the dialog and its choice word it
function getIntegrationAuthenticationMessage(authentication: IntegrationAuthentication) {
  return AUTHENTICATION_MESSAGES[authentication]
}

export default getIntegrationAuthenticationMessage
