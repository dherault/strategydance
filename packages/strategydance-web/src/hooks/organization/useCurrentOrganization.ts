import { use } from 'react'

import CurrentOrganizationContext from '~contexts/CurrentOrganizationContext'

function useCurrentOrganization() {
  return use(CurrentOrganizationContext)
}

export default useCurrentOrganization
