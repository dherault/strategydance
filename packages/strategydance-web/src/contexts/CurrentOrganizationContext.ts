import { createContext } from 'react'
import type { OrganizationRole } from 'strategydance-database/web'

import type { Organization } from '~types'

/*
  Which organization the reader is looking at, and what they are in it.

  A choice rather than a data source, which is why this carries none of `DataSource`'s four
  names: the reading is `UserOrganizationsContext`'s, and this one only says which of its rows
  is the current one. `role` rides along because it is a fact about the pair, and a consumer
  that has the organization would otherwise go back to the list to find it again, and `jobTitle`
  for the same reason.

  On an organization's pages it is the one the path leads with. Anywhere else, and on a path
  leading with an organization the reader is not in, it is the one they last had open
*/
export type CurrentOrganizationContextType = {
  organization: Organization | null
  role: OrganizationRole | null
  jobTitle: string | null
  // What the organization's paths lead with, its slug or its id while it has none, to link with
  organizationSlug: string | null
  // The path leads with an organization the reader is not in, which `CurrentOrganizationBouncer`
  // shows as not found
  isRouteOrganizationMissing: boolean
  // Remembers the organization for the pages outside any organization, and for the next visit.
  // On an organization's pages the path decides: `useSwitchOrganization` also navigates there
  setOrganizationId: (organizationId: string) => void
}

export default createContext<CurrentOrganizationContextType>({
  organization: null,
  role: null,
  jobTitle: null,
  organizationSlug: null,
  isRouteOrganizationMissing: false,
  setOrganizationId: () => {},
})
