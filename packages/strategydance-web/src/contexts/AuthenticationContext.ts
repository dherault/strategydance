import type { User as Viewer } from 'firebase/auth'
import { createContext } from 'react'

import type { DataSource } from '~types'

/*
  The Firebase account, which is not the same thing as the user row: this one is the identity
  the SDK holds, `UserContext` is the row Postgres keeps about it. Gating is this one's job,
  because it resolves first and resolves for somebody who has no row yet
*/
export type AuthenticationContextType = DataSource<Viewer | null> & {
  emailVerified: boolean
  signOut: () => Promise<void>
}

export default createContext<AuthenticationContextType>({
  data: null,
  initialLoading: false,
  loading: false,
  refetch: async () => {},
  emailVerified: false,
  signOut: async () => {},
})
