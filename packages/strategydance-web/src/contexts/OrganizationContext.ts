import { createContext } from 'react'
import type { OrganizationRole } from 'strategydance-database/web'

import type { DataSource, Organization, OrganizationMembership } from '~types'

/*
  Every organization the reader belongs to, and which one they are looking at.

  `data` is memberships rather than organizations because the role lives on the membership, and
  the `_via_` relation Data Connect generates is typed `[Organization!]!` and so cannot carry
  one. `organization` and `role` are the selected membership pulled apart, for the consumers that
  only want one of them: both are derived during render from the persisted id and the loaded
  list, so there is no second copy of the selection to fall out of step with the first
*/
export type OrganizationContextType = DataSource<OrganizationMembership[]> & {
  organization: Organization | null
  role: OrganizationRole | null
  setOrganizationId: (organizationId: string) => void
  createOrganization: (name: string) => Promise<void>
}

export default createContext<OrganizationContextType>({
  data: [],
  initialLoading: false,
  loading: false,
  refetch: async () => {},
  organization: null,
  role: null,
  setOrganizationId: () => {},
  createOrganization: async () => {},
})
