import { use } from 'react'

import UserOrganizationsContext from '~contexts/UserOrganizationsContext'

function useUserOrganizations() {
  return use(UserOrganizationsContext)
}

export default useUserOrganizations
