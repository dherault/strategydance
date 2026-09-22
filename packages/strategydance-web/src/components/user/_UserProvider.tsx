import { type PropsWithChildren, useCallback, useEffect, useRef } from 'react'
import type { UpdateCurrentUserVariables } from 'strategydance-database/web'
import { useCreateCurrentUser, useGetCurrentUser, useUpdateCurrentUser } from 'strategydance-database/web/react'

import type { UserContextType } from '~contexts/UserContext'

import UserContext from '~contexts/UserContext'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useAppIntl from '~hooks/intl/useAppIntl'
import useSystemTimezone from '~hooks/user/useSystemTimezone'

import fromDatabaseLocale from '~utils/user/fromDatabaseLocale'
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
  const { locale, setLocale } = useAppIntl()
  const timezone = useSystemTimezone()

  const viewerId = viewer?.uid ?? null

  /*
    The query key carries the uid, so signing into a second account on the same tab does not
    read the first one's row out of the cache while the new request is in flight.

    `enabled` keeps it from running for a signed out reader, whose token the `@auth(level: USER)`
    operation would refuse anyway
  */
  const { data, isPending, refetch: refetchUser } = useGetCurrentUser(dataConnect, {
    queryKey: ['GetCurrentUser', viewerId],
    enabled: Boolean(viewerId),
  })

  const { mutateAsync: createCurrentUser } = useCreateCurrentUser(dataConnect)
  const { mutateAsync: updateCurrentUser } = useUpdateCurrentUser(dataConnect)

  // Insert runs from an effect that also re-runs on `locale` and `timezone`, and the row it is
  // inserting does not exist until the write lands. Without this the second run fires a second
  // insert, which Postgres then refuses for a duplicate key
  const insertingForViewerIdRef = useRef<string | null>(null)
  const hasSyncedLocaleRef = useRef(false)

  const user = viewerId ? data?.user ?? null : null
  const loading = Boolean(viewerId) && isPending

  const refetch = useCallback(async () => {
    await refetchUser()
  }, [
    refetchUser,
  ])

  const updateUser = useCallback(async (variables: UpdateCurrentUserVariables) => {
    try {
      await updateCurrentUser(variables)
      await refetchUser()
    }
    catch (error) {
      console.error('Failed to update the user', error)
    }
  }, [
    updateCurrentUser,
    refetchUser,
  ])

  // Insert the row the first time this account is seen
  useEffect(() => {
    if (!viewer || loading || user) return

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

        console.error('Failed to create the user', error)
      })
  }, [
    viewer,
    user,
    loading,
    locale,
    timezone,
    createCurrentUser,
    refetchUser,
  ])

  // Keep the mirrored columns in step with the Firebase profile
  useEffect(() => {
    if (!viewer || !user) return

    const authenticationProviders = getAuthenticationProviders(viewer)

    const hasDrifted = user.displayName !== viewer.displayName
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

    updateUser({
      displayName: viewer.displayName,
      imageUrl: viewer.photoURL,
      timezone: timezone ?? user.timezone,
      authenticationProviders,
    })
  }, [
    viewer,
    user,
    timezone,
    updateUser,
  ])

  /*
    Adopt the language the account was created in, once, and only when the reader has not
    already chosen one this session. After that the browser's preference wins: the stored value
    is a hint for what gets sent to somebody, not a remote control for the tab they are in
  */
  useEffect(() => {
    if (!user) return
    if (hasSyncedLocaleRef.current) return

    hasSyncedLocaleRef.current = true

    const userLocale = fromDatabaseLocale(user.locale)

    if (userLocale === locale) return

    setLocale(userLocale)
  }, [
    user,
    locale,
    setLocale,
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
