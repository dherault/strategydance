import { createContext } from 'react'
import type { OrganizationRole } from 'strategydance-database/web'

import type { Organization } from '~types'

/*
  Which organization the reader is looking at, and what they are in it.

  A choice rather than a data source, which is why this carries none of `DataSource`'s four
  names: the reading is `UserOrganizationsContext`'s, and this one only says which of its rows
  is the current one. `role` rides along because it is a fact about the pair, and a consumer
  that has the organization would otherwise go back to the list to find it again
*/
export type CurrentOrganizationContextType = {
  organization: Organization | null
  role: OrganizationRole | null
  setOrganizationId: (organizationId: string) => void
}

export default createContext<CurrentOrganizationContextType>({
  organization: null,
  role: null,
  setOrganizationId: () => {},
})
