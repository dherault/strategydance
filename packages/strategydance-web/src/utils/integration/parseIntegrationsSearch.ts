import { MAX_INTEGRATION_NAME_LENGTH } from 'strategydance-core'

// A server's id as the app writes it into an address: hyphenated, so the router's JSON parsing of the
// query leaves it as text
const HYPHENATED_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type IntegrationsRouteSearch = {
  // A server of the organization whose dialog opens
  open?: string
  // A server whose dialog opens for the reader to connect their own account, which only a click
  // starts, since a browser opens a sign-in window only inside one
  connect?: string
  // A server an administrator turns on
  enable?: string
  // A server's name, which an administrator adds, from the catalogue when it lists one by that name
  add?: string
}

/*
  What the Integrations page reads of the query a conversation's thread sends it with, from the
  warning strip under a call to a server that does not work for the reader: the server to open, to
  connect, to turn on, each a hyphenated UUID, or the name of one to add again. Every key is written,
  `undefined` for one that is not what it should be, since TanStack lays what `validateSearch`
  returns over the raw query rather than replacing it
*/
function parseIntegrationsSearch(search: Record<string, unknown>): IntegrationsRouteSearch {
  return {
    open: readId(search.open),
    connect: readId(search.connect),
    enable: readId(search.enable),
    add:
      typeof search.add === 'string' && search.add.trim() && [...search.add].length <= MAX_INTEGRATION_NAME_LENGTH
        ? search.add
        : undefined,
  }
}

function readId(value: unknown) {
  return typeof value === 'string' && HYPHENATED_UUID_PATTERN.test(value) ? value : undefined
}

export { type IntegrationsRouteSearch }

export default parseIntegrationsSearch
