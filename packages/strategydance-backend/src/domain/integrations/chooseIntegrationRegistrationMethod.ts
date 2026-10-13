import type { IntegrationClientAuthenticationMethod } from '~domain/integrations/isIntegrationClientAuthenticationMethod'

/*
  How a registration asks to authenticate at an authorization server's token endpoint, of the methods
  its metadata lists: as a public client, PKCE being the proof, wherever it takes one, else with a
  secret in a Basic header, else in the form. A server that lists none of them, or lists nothing, is
  asked for a public client all the same, as MCP's servers take: RFC 8414 reads a list left out as
  `client_secret_basic`, but the registration answers the method the server chose, which is the one
  kept
*/
function chooseIntegrationRegistrationMethod(
  supported: readonly string[] | undefined,
): IntegrationClientAuthenticationMethod {
  if (!supported || supported.includes('none')) return 'none'
  if (supported.includes('client_secret_basic')) return 'client_secret_basic'
  if (supported.includes('client_secret_post')) return 'client_secret_post'

  return 'none'
}

export default chooseIntegrationRegistrationMethod
