import { useQuery, useQueryClient } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { type GetCurrentUserOrganizationsData, getOrganizationTeamRef } from 'strategydance-database/web'

import type { DataSource, OrganizationTeam } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

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

  /*
    The reader's own row in a pushed team says what they are in it now: their access, and what
    they do there. When either differs from what their memberships say, somebody changed it or
    removed them, and the memberships are read again: the sidebar follows, a removed reader's
    current organization moves on to another, and their account page shows the new job title
  */
  function syncMemberships(team: OrganizationTeam) {
    const memberships = queryClient.getQueryData<GetCurrentUserOrganizationsData>(['GetCurrentUserOrganizations', viewerId])
    const known = memberships?.userOrganizations.find(membership => membership.organization.id === organizationId)
    const pushed = team.userOrganizations.find(member => member.user.id === viewerId)

    const isRoleChanged = (known?.role ?? null) !== (pushed?.role ?? null)
    const isJobTitleChanged = (known?.jobTitle ?? null) !== (pushed?.jobTitle ?? null)

    if (isRoleChanged || isJobTitleChanged) queryClient.invalidateQueries({ queryKey: ['GetCurrentUserOrganizations'] })
  }

  useLiveQuerySubscription({
    name: 'team',
    queryKey: organizationId ? ['GetOrganizationTeam', organizationId] : null,
    createQueryRef: () => getOrganizationTeamRef(dataConnect, { organizationId: organizationId! }),
    onNext: syncMemberships,
  })

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
