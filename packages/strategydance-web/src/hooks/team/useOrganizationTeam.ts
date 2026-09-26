import { useQuery, useQueryClient } from '@tanstack/react-query'
import { executeQuery, subscribe } from 'firebase/data-connect'
import { useEffect } from 'react'
import { type GetCurrentUserOrganizationsData, getOrganizationTeamRef } from 'strategydance-database/web'

import type { DataSource, OrganizationTeam } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

// How long a subscription that failed waits before it opens again, doubling up to the maximum
const REOPEN_INITIAL_DELAY_MS = 1000
const REOPEN_MAX_DELAY_MS = 60 * 1000

const EMPTY_TEAM: OrganizationTeam = {
  userOrganizations: [],
  organizationInvitations: [],
}

/*
  The current organization's members and pending invitations, kept live.

  The first read is an ordinary query, which is what `TeamWait` waits on. The subscription beside
  it is what keeps it current: `GetOrganizationTeam` names every mutation that changes a team in
  its `@refresh`, the server pushes a new result after each, and the result is written into the
  same cache entry. Nothing on the page refetches after it writes, and a change made by somebody
  else arrives the same way.

  `useQuery` is called directly rather than through the generated `useGetOrganizationTeam`. That
  wrapper keeps its query ref in state and updates it in an effect, so on the render where the
  organization changes it would read the previous organization's team into the new one's key.

  Every caller subscribes, and the SDK shares one stream between subscriptions to the same query.

  A first read that fails is not an empty team: `hasFailed` says so, and the page offers to try
  again rather than show nobody. It does not retry on mount, since with nothing cached a retry
  resets the query to pending, `TeamWait` unmounts the page, and the page's return would retry
  again, forever
*/
function useOrganizationTeam(): DataSource<OrganizationTeam> & { hasFailed: boolean } {
  const queryClient = useQueryClient()
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['GetOrganizationTeam', organizationId],
    queryFn: async () => {
      const { data: team } = await executeQuery(getOrganizationTeamRef(dataConnect, { organizationId: organizationId! }))

      return team
    },
    enabled: Boolean(organizationId),
    retryOnMount: false,
  })

  useEffect(() => {
    if (!organizationId) return

    const queryKey = ['GetOrganizationTeam', organizationId]

    /*
      The reader's own row in a pushed team says what they are in it now. When that differs from
      what their memberships say, somebody changed their access or removed them, and the
      memberships are read again: the sidebar follows, and a removed reader's current
      organization moves on to another
    */
    function syncMemberships(team: OrganizationTeam) {
      const memberships = queryClient.getQueryData<GetCurrentUserOrganizationsData>(['GetCurrentUserOrganizations', viewerId])
      const knownRole = memberships?.userOrganizations.find(membership => membership.organization.id === organizationId)?.role ?? null
      const pushedRole = team.userOrganizations.find(member => member.user.id === viewerId)?.role ?? null

      if (knownRole !== pushedRole) queryClient.invalidateQueries({ queryKey: ['GetCurrentUserOrganizations'] })
    }

    /*
      The SDK reconnects a dropped stream by itself and resends the subscription, but when it
      gives up it reports the error and unsubscribes every callback, and nothing would ever open
      the subscription again: the page would stop being live without a sign. So any error, and a
      failure to open the stream at all, which throws rather than reaching `onErr`, closes this
      subscription and opens a new one after a delay that doubles each time, up to a minute, and
      starts over once a result arrives. The team stays as last read meanwhile
    */
    let unsubscribe: (() => void) | null = null
    let reopenTimeout: ReturnType<typeof setTimeout> | undefined
    let reopenDelay = REOPEN_INITIAL_DELAY_MS
    let isClosed = false

    function reopen() {
      if (isClosed || reopenTimeout) return

      unsubscribe?.()
      unsubscribe = null

      reopenTimeout = setTimeout(() => {
        reopenTimeout = undefined
        open()
      }, reopenDelay)

      reopenDelay = Math.min(reopenDelay * 2, REOPEN_MAX_DELAY_MS)
    }

    function open() {
      try {
        unsubscribe = subscribe(getOrganizationTeamRef(dataConnect, { organizationId: organizationId! }), {
          onNext: ({ data: team }) => {
            reopenDelay = REOPEN_INITIAL_DELAY_MS
            queryClient.setQueryData(queryKey, team)
            syncMemberships(team)
          },
          onErr: error => {
            console.error('The live team query failed, reopening it', error)
            reopen()
          },
        })
      }
      catch (error) {
        console.error('Could not subscribe to the team, retrying', error)
        reopen()
      }
    }

    open()

    return () => {
      isClosed = true
      clearTimeout(reopenTimeout)
      unsubscribe?.()
    }
  }, [
    organizationId,
    queryClient,
    viewerId,
  ])

  return {
    data: data ?? EMPTY_TEAM,
    initialLoading: Boolean(organizationId) && isPending && !isError,
    loading: Boolean(organizationId) && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: Boolean(organizationId) && isError && data === undefined,
  }
}

export default useOrganizationTeam
