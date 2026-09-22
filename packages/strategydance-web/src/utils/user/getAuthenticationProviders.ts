import { GoogleAuthProvider, type User as Viewer } from 'firebase/auth'
import { AuthenticationProvider } from 'strategydance-database/web'

// Firebase's own ids, which are strings rather than an enum and are not ours to rename
const PROVIDER_IDS: Record<string, AuthenticationProvider> = {
  password: AuthenticationProvider.PASSWORD,
  [GoogleAuthProvider.PROVIDER_ID]: AuthenticationProvider.GOOGLE,
}

/*
  The ways this account can sign in, sorted so two reads of the same account compare equal and
  the provider does not write a row that only differs in order.

  An id with no entry here is dropped rather than guessed at: a provider this app never enabled
  can still appear on an account that was linked elsewhere
*/
function getAuthenticationProviders(viewer: Viewer): AuthenticationProvider[] {
  const providers = viewer.providerData
    .map(({ providerId }) => PROVIDER_IDS[providerId])
    .filter(provider => provider !== undefined)

  return [...new Set(providers)].sort()
}

export default getAuthenticationProviders
