import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { readDirectoryStatus } from 'strategydance-core'
import { getDirectoryUsesRef } from 'strategydance-database/web'

import type { DataSource, DirectoryState } from '~types'

import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

const EMPTY_STATES = new Map<string, DirectoryState>()

/*
  What the current organization keeps of each directory, by its id: its status and since when, and
  the plain text of its notes, kept live, so a status a teammate or the agent sets shows on every
  open page. A row from before statuses, in use with none, reads as submitted. Rows naming a
  directory the release's list no longer holds, an inactive one's among them, are kept here and
  read past by whoever looks them up.

  As `useBills` does, the first read is an ordinary query, which the page's waiter waits on, and the
  subscription beside it writes what the server pushes into the same cache entry. A first read that
  fails is not an organization with nothing kept: `hasFailed` says so, and it does not retry on
  mount, for the reason `useOrganizationTeam` gives
*/
function useDirectoryStates(): DataSource<Map<string, DirectoryState>> & { hasFailed: boolean } {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['GetDirectoryUses', organizationId],
    queryFn: async () => {
      const { data: result } = await executeQuery(getDirectoryUsesRef(dataConnect, { organizationId: organizationId! }))

      return result
    },
    enabled: Boolean(organizationId),
    retryOnMount: false,
  })

  useLiveQuerySubscription({
    name: 'directories',
    queryKey: organizationId ? ['GetDirectoryUses', organizationId] : null,
    createQueryRef: () => getDirectoryUsesRef(dataConnect, { organizationId: organizationId! }),
  })

  function toStates() {
    if (!data) return EMPTY_STATES

    const states = new Map<string, DirectoryState>()

    for (const use of data.knowledgeUses) {
      states.set(use.itemId, { status: readDirectoryStatus(use), changedAt: use.changedAt, notesText: null })
    }

    for (const note of data.knowledgeNotes) {
      const state = states.get(note.itemId) ?? { status: null, changedAt: null, notesText: null }

      states.set(note.itemId, { ...state, notesText: note.contentText ?? '' })
    }

    return states
  }

  return {
    data: toStates(),
    initialLoading: Boolean(organizationId) && isPending && !isError,
    loading: Boolean(organizationId) && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: Boolean(organizationId) && isError && data === undefined,
  }
}

export default useDirectoryStates
