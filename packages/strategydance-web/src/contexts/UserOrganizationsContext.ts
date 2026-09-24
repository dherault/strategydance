import { createContext } from 'react'
import type { CompanyAspect } from 'strategydance-database/web'

import type { DataSource, UserOrganization } from '~types'

/*
  Every organization the reader belongs to, and what they are in each.

  Memberships rather than organizations, because the role lives on the membership: the `_via_`
  relation Data Connect generates is typed `[Organization!]!` and so has nowhere to carry one.

  Which of them the reader is currently looking at is `CurrentOrganizationContext`, not this one.
  This context owns the list; that one owns the choice
*/
export type UserOrganizationsContextType = DataSource<UserOrganization[]> & {
  // Resolves once the new row is readable, and answers with its id so the caller can select it.
  // Selecting is deliberately not done here: this context does not know what is selected
  createOrganization: (name: string) => Promise<string>
  // Adds an aspect to the organization's explored ones, and resolves once the list shows it
  exploreCompanyAspect: (organizationId: string, aspect: CompanyAspect) => Promise<void>
}

export default createContext<UserOrganizationsContextType>({
  data: [],
  initialLoading: false,
  loading: false,
  refetch: async () => {},
  createOrganization: async () => '',
  exploreCompanyAspect: async () => {},
})
