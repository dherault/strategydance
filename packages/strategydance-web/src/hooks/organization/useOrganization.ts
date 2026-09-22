import { use } from 'react'

import OrganizationContext from '~contexts/OrganizationContext'

function useOrganization() {
  return use(OrganizationContext)
}

export default useOrganization
