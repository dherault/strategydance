import type { IntegrationAuthorizationOutcome } from 'strategydance-core'

// A UUID as the backend writes one into an address the app reads: hyphenated, so the router's JSON
// parsing of the query leaves it as text
const HYPHENATED_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const OUTCOMES: readonly unknown[] = ['received', 'denied', 'failed'] satisfies IntegrationAuthorizationOutcome[]

type IntegrationConnectedRouteSearch = {
  outcome?: IntegrationAuthorizationOutcome
  organization?: string
  integration?: string
  authorization?: string
}

/*
  What the page a sign-in ends on reads of the query the backend's callback sent it with: a known
  outcome, and the ids of the Connect it came back from, each a hyphenated UUID or nothing. Every key
  is written, `undefined` for one that is not what it should be, since TanStack lays what
  `validateSearch` returns over the raw query rather than replacing it
*/
function parseIntegrationConnectedSearch(search: Record<string, unknown>): IntegrationConnectedRouteSearch {
  return {
    outcome: OUTCOMES.includes(search.outcome) ? (search.outcome as IntegrationAuthorizationOutcome) : undefined,
    organization: readId(search.organization),
    integration: readId(search.integration),
    authorization: readId(search.authorization),
  }
}

function readId(value: unknown) {
  return typeof value === 'string' && HYPHENATED_UUID_PATTERN.test(value) ? value : undefined
}

export { type IntegrationConnectedRouteSearch }

export default parseIntegrationConnectedSearch
