import { useQuery } from '@tanstack/react-query'
import type { Directory } from 'strategydance-knowledge/src/directories/types'

import loadDirectories from '~data/directories/loadDirectories'

const EMPTY_DIRECTORIES: Directory[] = []

/*
  The directories open to a submission today, the same for every organization and shipped with the
  release, so read once a session and never again. A download that failed is no catalogue without a
  directory: `hasFailed` says so, and it does not retry on mount, as a waiter and its page both read
  it
*/
function useDirectories() {
  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['directories'],
    queryFn: loadDirectories,
    staleTime: Infinity,
    gcTime: Infinity,
    retryOnMount: false,
  })

  return {
    data: data ?? EMPTY_DIRECTORIES,
    initialLoading: isPending && !isError,
    loading: isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: isError && data === undefined,
  }
}

export default useDirectories
