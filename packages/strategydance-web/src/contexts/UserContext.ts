import { createContext } from 'react'
import type { UpdateCurrentUserVariables } from 'strategydance-database/web'

import type { DataSource, User } from '~types'

// The Postgres row, as opposed to the Firebase account in `AuthenticationContext`. It arrives
// later and can legitimately be absent for a moment: an account exists from the instant it is
// created, its row only once the first insert lands
export type UserContextType = DataSource<User | null> & {
  updateUser: (variables: UpdateCurrentUserVariables) => Promise<void>
}

export default createContext<UserContextType>({
  data: null,
  initialLoading: false,
  loading: false,
  refetch: async () => {},
  updateUser: async () => {},
})
