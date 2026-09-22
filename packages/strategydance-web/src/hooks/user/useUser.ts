import { use } from 'react'

import UserContext from '~contexts/UserContext'

function useUser() {
  return use(UserContext)
}

export default useUser
