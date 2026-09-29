import { createContext } from 'react'

import type { DataSource, User, UserProfile } from '~types'

// The Postgres row, as opposed to the Firebase account in `AuthenticationContext`. It arrives
// later and can legitimately be absent for a moment: an account exists from the instant it is
// created, its row only once the first insert lands
export type UserContextType = DataSource<User | null> & {
  // Saves what the account page's form edits, and resolves once the row shows it
  updateProfile: (profile: UserProfile) => Promise<void>
  // Saves a profile picture, or null to remove it, and resolves once the row shows it
  changePicture: (image: Blob | null) => Promise<void>
}

export default createContext<UserContextType>({
  data: null,
  initialLoading: false,
  loading: false,
  refetch: async () => {},
  updateProfile: async () => {},
  changePicture: async () => {},
})
