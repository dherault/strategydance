import toCanonicalUuid from '~utils/toCanonicalUuid'

/*
  What an integration's secret is bound to, as additional authenticated data: what it is, the
  organization and the server, in their canonical form whatever spelling a route was called with, and
  for a member's secrets the connection's generation or the Connect's id, and the member, last, since
  a uid is no UUID and keeps its own spelling. A ciphertext copied into another row, or into a column
  of another kind, opens nothing there: an access token never opens as a refresh token, nor one
  member's as another's.

  The API key's context is the one M27 wrote its keys under, so they open as they did
*/
function buildIntegrationSecretContext(owner: IntegrationSecretOwner) {
  const base = `integration-${owner.purpose}:${toCanonicalUuid(owner.organizationId)}:${toCanonicalUuid(owner.integrationId)}`

  switch (owner.purpose) {
    case 'api-key':
    case 'client-secret':
      return Buffer.from(base)
    case 'access-token':
    case 'refresh-token':
      return Buffer.from(`${base}:${toCanonicalUuid(owner.generation)}:${owner.userId}`)
    case 'code-verifier':
    case 'authorization-code':
      return Buffer.from(`${base}:${toCanonicalUuid(owner.authorizationId)}:${owner.userId}`)
  }
}

// The server a secret of the organization's is for: its key, or the client registered with its
// authorization server
type IntegrationKeyOwner = {
  organizationId: string
  integrationId: string
}

type IntegrationSecretOwner =
  | (IntegrationKeyOwner & { purpose: 'api-key' | 'client-secret' })
  // A member's tokens, under their connection's generation
  | (IntegrationKeyOwner & { purpose: 'access-token' | 'refresh-token'; generation: string; userId: string })
  // A member's Connect under way: its PKCE verifier and the code it brought back
  | (IntegrationKeyOwner & {
      purpose: 'code-verifier' | 'authorization-code'
      authorizationId: string
      userId: string
    })

export { type IntegrationKeyOwner, type IntegrationSecretOwner }

export default buildIntegrationSecretContext
