import type { GitHubClient } from '~types'

import { OUTBOUND_USER_AGENT } from '~constants'

const API_URL = 'https://api.github.com'

// How long one call may take
const TIMEOUT_MS = 30 * 1000

// A call GitHub answered with a status the caller did not expect, or a GraphQL query it refused
export class GitHubError extends Error {
  name = 'GitHubError'
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/*
  GitHub's API as the token given: its REST calls, answered with their status and their body, JSON
  or text as GitHub sends it, and its GraphQL queries. A status outside 2xx throws a `GitHubError`,
  but those the caller says it handles. GitHub is a fixed host, so `fetch` reaches it directly
*/
function createGitHubClient(token: string): GitHubClient {
  const headers = {
    authorization: `Bearer ${token}`,
    'user-agent': OUTBOUND_USER_AGENT,
    'x-github-api-version': '2022-11-28',
  }

  return {
    async request(method, path, { body, accept = 'application/vnd.github+json', allowedStatuses = [] } = {}) {
      const init: RequestInit = {
        method,
        headers: { ...headers, accept, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }

      if (body !== undefined) init.body = JSON.stringify(body)

      const response = await fetch(`${API_URL}${path}`, init)
      const text = await response.text()
      const data = (response.headers.get('content-type') ?? '').includes('json') && text ? JSON.parse(text) : text

      if (!response.ok && !allowedStatuses.includes(response.status)) {
        throw new GitHubError(
          `GitHub answered ${method} ${path} with ${response.status}: ${text.slice(0, 500)}`,
          response.status,
        )
      }

      return { status: response.status, data }
    },

    async graphql(query, variables) {
      const { data } = await this.request('POST', '/graphql', { body: { query, variables } })
      const { data: result, errors } = data as { data?: unknown; errors?: { message: string }[] }

      if (errors?.length)
        throw new GitHubError(`GitHub refused a query: ${errors.map(({ message }) => message).join('; ')}`, 200)

      return result as never
    },
  }
}

export default createGitHubClient
