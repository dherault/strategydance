import { useQuery } from '@tanstack/react-query'

import { GITHUB_REPOSITORY } from '~constants'

// An hour, since a count that is a little late costs nothing, and the API allows sixty
// unauthenticated reads an hour per address
const STALE_TIME = 60 * 60 * 1000

async function fetchStargazers() {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}`)

  if (!response.ok) throw new Error(`GitHub answered ${response.status}`)

  const repository: { stargazers_count: number } = await response.json()

  return repository.stargazers_count
}

// How many people starred the project on GitHub, or nothing while that is unknown
function useGitHubStargazers() {
  return useQuery({
    queryKey: ['gitHubStargazers', GITHUB_REPOSITORY],
    queryFn: fetchStargazers,
    staleTime: STALE_TIME,
    retry: false,
  })
}

export default useGitHubStargazers
