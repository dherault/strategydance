import { MODULES } from 'strategydance-core'

import { OAUTH_ISSUER } from '~constants'

/*
  The authorization server's metadata (RFC 8414), which a client reads to find everything else: the
  endpoints, dynamic registration among them, what it serves and how. Every client is public, so the
  token and revocation endpoints take no authentication but the `client_id` a request names, which
  both say, since a field left out would mean `client_secret_basic`. It names the issuer in every
  authorization's answer (RFC 9207), and takes client ID metadata documents, which claude.ai and
  ChatGPT use when it says so
*/
function buildAuthorizationServerMetadata() {
  return {
    issuer: OAUTH_ISSUER,
    authorization_endpoint: `${OAUTH_ISSUER}/oauth/authorize`,
    token_endpoint: `${OAUTH_ISSUER}/oauth/token`,
    registration_endpoint: `${OAUTH_ISSUER}/oauth/register`,
    revocation_endpoint: `${OAUTH_ISSUER}/oauth/revoke`,
    scopes_supported: MODULES.flatMap(({ scopes }) => [scopes.read, scopes.write]),
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint_auth_methods_supported: ['none'],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  }
}

export default buildAuthorizationServerMetadata
