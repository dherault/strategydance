import { type PropsWithChildren, useEffect, useRef, useState } from 'react'
import type { UpdateCurrentUserVariables } from 'strategydance-database/web'
import { useCreateCurrentUser, useGetCurrentUser, useUpdateCurrentUser } from 'strategydance-database/web/react'

import type { UserContextType } from '~contexts/UserContext'

import UserContext from '~contexts/UserContext'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useAppIntl from '~hooks/intl/useAppIntl'
import useSystemTimezone from '~hooks/user/useSystemTimezone'

import getAuthenticationProviders from '~utils/user/getAuthenticationProviders'
import toDatabaseLocale from '~utils/user/toDatabaseLocale'

import { dataConnect } from '~data/firebase'

/*
  Owns the reader's row: reads it, inserts it the first time the account is seen, and keeps the
  handful of columns that mirror the Firebase profile in step with it.

  Mounted in `Wrap` below `_AuthenticationProvider`, and like every provider there it renders
  its children unconditionally. `UserWait` is the half that gates
*/
function UserProvider({ children }: PropsWithChildren) {
  const { data: viewer } = useAuthentication()
  const { locale } = useAppIntl()
  const timezone = useSystemTimezone()

  const viewerId = viewer?.uid ?? null

  /*
    The query key carries the uid, so signing into a second account on the same tab does not
    read the first one's row out of the cache while the new request is in flight.

    `enabled` keeps it from running for a signed out reader, whose token the `@auth(level: USER)`
    operation would refuse anyway
  */
  const { data, isPending, isError, refetch: refetchUser } = useGetCurrentUser(dataConnect, {
    queryKey: ['GetCurrentUser', viewerId],
    enabled: Boolean(viewerId),
  })

  const { mutateAsync: createCurrentUser } = useCreateCurrentUser(dataConnect)
  const { mutateAsync: updateCurrentUser } = useUpdateCurrentUser(dataConnect)

  // Insert runs from an effect that also re-runs on `locale` and `timezone`, and the row it is
  // inserting does not exist until the write lands. Without this the second run fires a second
  // insert, which Postgres then refuses for a duplicate key
  const insertingForViewerIdRef = useRef<string | null>(null)

  // Whose insert failed, rather than a bare boolean, so signing into another account on the
  // same tab starts from a clean slate instead of inheriting the last one's failure
  const [insertFailedForViewerId, setInsertFailedForViewerId] = useState<string | null>(null)

  const user = viewerId ? data?.user ?? null : null

  // The read has answered, which is a different thing from there being a row. It is the
  // precondition for inserting one: before it, "no row" only means "not asked yet"
  const hasReadUser = Boolean(viewerId) && !isPending

  /*
    True until the row actually exists, not merely until the read resolves. Between a first
    read that finds nothing and the insert landing there is no row and nothing pending, and
    releasing the waiter there renders `/-` with `useUser().data` still null, which is the one
    thing the route promises cannot happen.

    `isError` releases it anyway. A read this reader is not allowed to make is not going to
    start working, and a hang says less than an empty screen does
  */
  const loading = Boolean(viewerId) && !user && !isError && insertFailedForViewerId !== viewerId

  async function refetch() {
    await refetchUser()
  }

  async function updateUser(variables: UpdateCurrentUserVariables) {
    try {
      await updateCurrentUser(variables)
      await refetchUser()
    }
    catch (error) {
      console.error('Failed to update the user', error)
    }
  }

  // Insert the row the first time this account is seen
  useEffect(() => {
    if (!viewer || !hasReadUser || user) return

    /*
      The schema requires an email and the mutation reads it off the token, so an account
      carrying none cannot have a row. Neither enabled provider produces one, which is why this
      is a log rather than a screen: reaching it means the project gained a provider nothing
      here was written for
    */
    if (!viewer.email) {
      console.error('Cannot create a user for an account with no email address')

      return
    }

    if (insertingForViewerIdRef.current === viewer.uid) return

    insertingForViewerIdRef.current = viewer.uid

    createCurrentUser({
      displayName: viewer.displayName,
      imageUrl: viewer.photoURL,
      locale: toDatabaseLocale(locale),
      timezone,
      authenticationProviders: getAuthenticationProviders(viewer),
    })
      .then(() => refetchUser())
      .catch(error => {
        insertingForViewerIdRef.current = null

        // Releases the waiter. Nothing re-runs this effect on its own, so without it the
        // failure is a permanent spinner rather than a page that renders and says nothing
        setInsertFailedForViewerId(viewer.uid)

        console.error('Failed to create the user', error)
      })
  }, [
    viewer,
    user,
    hasReadUser,
    locale,
    timezone,
    createCurrentUser,
    refetchUser,
  ])

  // Keep the mirrored columns in step with the Firebase profile
  useEffect(() => {
    if (!viewer || !user) return

    const authenticationProviders = getAuthenticationProviders(viewer)

    /*
      `email` is compared even though the mutation reads it off the token rather than from
      here. It is the column the sign-in screen looks accounts up by, so an address that
      changed in Firebase and not in Postgres is an account nobody can find again
    */
    const hasDrifted = user.email !== viewer.email
      || user.displayName !== viewer.displayName
      || user.imageUrl !== viewer.photoURL
      || user.authenticationProviders.join() !== authenticationProviders.join()
      /*
        The one column the client keeps overwriting. Unlike `locale`, which is a preference
        somebody sets, this is a fact about where they are and the newest answer is the true
        one. Null is not written over a stored zone: a runtime that has stopped answering has
        not moved anybody
      */
      || Boolean(timezone && user.timezone !== timezone)

    // A mount is not a write. Without this every reload touches the row, and `updatedAt` stops
    // meaning anything
    if (!hasDrifted) return

    // The mutation rather than `updateUser`, so nothing this component defines ends up in a
    // dependency array. The compiler would keep such a function stable, but the lint rule
    // reads the source rather than the compiler's output and cannot know that
    updateCurrentUser({
      displayName: viewer.displayName,
      imageUrl: viewer.photoURL,
      timezone: timezone ?? user.timezone,
      authenticationProviders,
    })
      .then(() => refetchUser())
      .catch(error => {
        console.error('Failed to update the user', error)
      })
  }, [
    viewer,
    user,
    timezone,
    updateCurrentUser,
    refetchUser,
  ])

  const contextValue: UserContextType = {
    data: user,
    initialLoading: loading,
    loading,
    refetch,
    updateUser,
  }

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  )
}

export default UserProvider
