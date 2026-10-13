import type { IntegrationClientAuthenticationMethod } from '~domain/integrations/isIntegrationClientAuthenticationMethod'

/*
  How a registration asks to authenticate at an authorization server's token endpoint, of the methods
  its metadata lists: as a public client, PKCE being the proof, wherever it takes one, else with a
  secret in a Basic header, else in the form. A list left out means `client_secret_basic` alone, as
  RFC 8414 reads it. A server listing none of them is asked for a public client all the same: the
  registration answers the method the server chose, which is the one kept, or refuses
*/
function chooseIntegrationRegistrationMethod(
  supported: readonly string[] | undefined,
): IntegrationClientAuthenticationMethod {
  if (!supported) return 'client_secret_basic'
  if (supported.includes('none')) return 'none'
  if (supported.includes('client_secret_basic')) return 'client_secret_basic'
  if (supported.includes('client_secret_post')) return 'client_secret_post'

  return 'none'
}

export default chooseIntegrationRegistrationMethod
