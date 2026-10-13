import toCanonicalUuid from '~utils/toCanonicalUuid'

/*
  What a server's encrypted key is bound to, as additional authenticated data: what it is, the
  organization and the server, in their canonical form whatever spelling a route was called with. A
  ciphertext copied into another row, or into a column of another kind, as M28's tokens will be,
  opens nothing there
*/
function buildIntegrationKeyContext({ organizationId, integrationId }: IntegrationKeyOwner) {
  return Buffer.from(`integration-api-key:${toCanonicalUuid(organizationId)}:${toCanonicalUuid(integrationId)}`)
}

type IntegrationKeyOwner = {
  organizationId: string
  integrationId: string
}

export { type IntegrationKeyOwner }

export default buildIntegrationKeyContext
