import type { OrganizationImageKind } from 'strategydance-core'

import toCanonicalUuid from '~utils/toCanonicalUuid'

/*
  Where an organization's files live in the bucket, or one kind of them. Deleting the organization
  sweeps the first; each picture is a fresh name under the second, and only a file under it is
  ever deleted as the one a picture replaced
*/
function buildOrganizationStoragePrefix(organizationId: string, kind?: OrganizationImageKind) {
  const prefix = `organizations/${toCanonicalUuid(organizationId)}/`

  return kind ? `${prefix}${kind}/` : prefix
}

export default buildOrganizationStoragePrefix
