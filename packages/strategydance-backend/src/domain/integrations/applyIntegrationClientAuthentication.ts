import type { IntegrationOAuthClient } from '~domain/integrations/resolveIntegrationOAuthClient'

/*
  Authenticates Strategy Dance's client on a request to an authorization server's token or revocation
  endpoint, by the method its registration answered (RFC 6749, 2.3.1): the id and the secret each
  form-encoded, then joined, in a Basic header; both in the form; or the id alone, for a public client.
  Every endpoint goes through here, so a revocation authenticates exactly as the token requests did.
  The MCP SDK's own Basic header encodes neither part, which a secret holding a colon or a percent
  sign breaks
*/
function applyIntegrationClientAuthentication(client: IntegrationOAuthClient, headers: Headers, form: URLSearchParams) {
  if (client.authenticationMethod === 'client_secret_basic' && client.clientSecret !== null) {
    const credentials = `${formEncode(client.clientId)}:${formEncode(client.clientSecret)}`

    headers.set('authorization', `Basic ${Buffer.from(credentials).toString('base64')}`)

    return
  }

  form.set('client_id', client.clientId)

  if (client.authenticationMethod === 'client_secret_post' && client.clientSecret !== null) {
    form.set('client_secret', client.clientSecret)
  }
}

// A value as a form encodes it (application/x-www-form-urlencoded): a space as `+`, and anything but
// letters, digits and `*-._` escaped
function formEncode(value: string) {
  return new URLSearchParams({ value }).toString().slice('value='.length)
}

export default applyIntegrationClientAuthentication
