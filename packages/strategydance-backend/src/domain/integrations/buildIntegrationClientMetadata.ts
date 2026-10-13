import { PRODUCTION_APP_URL } from 'strategydance-core'

import { INTEGRATION_OAUTH_CALLBACK_URL } from '~constants'

import type { IntegrationClientAuthenticationMethod } from '~domain/integrations/isIntegrationClientAuthenticationMethod'

/*
  How Strategy Dance describes itself to an organization's authorization servers, as a client of
  theirs: by name, with its site and its mark, sending the browser back to its callback alone, for
  codes and refresh tokens, as a public client, PKCE being its proof, unless a registration asks for
  a secret a server needs (RFC 7591's fields, which a client ID metadata document holds too, always
  for a public client). A web application where the callback is https, and a native one in
  development, whose callback is a loopback address, which servers take from native clients alone
*/
function buildIntegrationClientMetadata(authenticationMethod: IntegrationClientAuthenticationMethod = 'none') {
  return {
    client_name: 'Strategy Dance',
    client_uri: PRODUCTION_APP_URL,
    logo_uri: `${PRODUCTION_APP_URL}/assets/images/logo/logo-primary-512.png`,
    redirect_uris: [INTEGRATION_OAUTH_CALLBACK_URL],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: authenticationMethod,
    application_type: INTEGRATION_OAUTH_CALLBACK_URL.startsWith('https://') ? 'web' : 'native',
  }
}

export default buildIntegrationClientMetadata
