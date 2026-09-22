import { type User as Viewer, signOut as firebaseSignOut, onIdTokenChanged } from 'firebase/auth'
import { type PropsWithChildren, useCallback, useEffect, useState } from 'react'

import AuthenticationContext, { type AuthenticationContextType } from '~contexts/AuthenticationContext'

import { authentication } from '~data/firebase'

/*
  Mounted in `Wrap`, so it renders its children unconditionally: withholding them there
  replaces the document itself, `<Scripts />` and all. `AuthenticationWait` is what holds the
  tree back while `loading` is true, and it lives inside the document.

  `loading` starts true and is cleared by the first listener call, which Firebase makes for a
  signed out reader too. Nothing below may read `data === null` as "signed out" before then:
  restoring a persisted session is a round trip, and a bouncer that fires during it sends
  somebody who is signed in to the sign-in page on every hard load
*/
function AuthenticationProvider({ children }: PropsWithChildren) {
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [emailVerified, setEmailVerified] = useState(false)
  const [loading, setLoading] = useState(true)

  // Reads `currentUser` rather than the state above, which keeps the callback identity stable
  // across a sign-in and lets a consumer put it in a dependency list without re-running
  const refetch = useCallback(async () => {
    const currentViewer = authentication.currentUser

    if (!currentViewer) return

    // The only way this tab learns the email was confirmed: the link is opened somewhere else,
    // and a restored session reports whatever was true at sign-in until it is asked again
    await currentViewer.reload()

    setEmailVerified(currentViewer.emailVerified)
  }, [])

  const signOut = useCallback(async () => {
    await firebaseSignOut(authentication)
  }, [])

  /*
    `onIdTokenChanged` rather than `onAuthStateChanged`: it fires on both, so a token minted
    after `reload()` reaches this listener too, and there is one place that decides what the
    viewer is
  */
  useEffect(() => onIdTokenChanged(authentication, nextViewer => {
    if (import.meta.env.DEV && nextViewer) console.log(`🙋 ${nextViewer.email}`)

    setViewer(nextViewer)
    setEmailVerified(nextViewer?.emailVerified ?? false)
    setLoading(false)
  }), [])

  const contextValue: AuthenticationContextType = {
    data: viewer,
    initialLoading: loading,
    loading,
    refetch,
    emailVerified,
    signOut,
  }

  return (
    <AuthenticationContext.Provider value={contextValue}>
      {children}
    </AuthenticationContext.Provider>
  )
}

export default AuthenticationProvider
