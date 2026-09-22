import { use } from 'react'

import AuthenticationContext from '~contexts/AuthenticationContext'

function useAuthentication() {
  return use(AuthenticationContext)
}

export default useAuthentication
