import { toCanonicalUuid } from 'strategydance-core'

import type { ReachedModuleOrganization } from '~types'

// A UUID, with or without its dashes, in either case
const UUID_PATTERN = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

/*
  The organization an external agent's call names in `organization`, among those its connection
  reaches: by what the tools list it as, its slug, or its id while it has none, or by its id in
  either form. Null for anything else, an organization the connection no longer reaches included,
  so a client holding an older list of tools never acts where it did not mean to
*/
function resolveModuleOrganization(organizations: readonly ReachedModuleOrganization[], named: string) {
  const id = UUID_PATTERN.test(named) ? toCanonicalUuid(named) : null

  return (
    organizations.find(
      ({ segment, organizationId }) => segment === named || (id !== null && toCanonicalUuid(organizationId) === id),
    ) ?? null
  )
}

export default resolveModuleOrganization
