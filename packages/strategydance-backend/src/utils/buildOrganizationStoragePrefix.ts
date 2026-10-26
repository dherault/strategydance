import type { OrganizationImageKind } from 'strategydance-core'

import toCanonicalUuid from '~utils/toCanonicalUuid'

// The folders of an organization's part of the bucket: one per picture it carries, one for the
// pictures its documents show, and one for its bills' receipts
type OrganizationStorageFolder = OrganizationImageKind | 'rich-text' | 'receipts'

/*
  Where an organization's files live in the bucket, or one kind of them. Deleting the organization
  sweeps the first; each picture is a fresh name under the second, and only a file under it is
  ever deleted as the one a picture replaced
*/
function buildOrganizationStoragePrefix(organizationId: string, kind?: OrganizationStorageFolder) {
  const prefix = `organizations/${toCanonicalUuid(organizationId)}/`

  return kind ? `${prefix}${kind}/` : prefix
}

export default buildOrganizationStoragePrefix
