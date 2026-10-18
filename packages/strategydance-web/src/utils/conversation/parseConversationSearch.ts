// An id as the app writes it into an address, hyphenated so the router's JSON parsing of the query
// leaves it as text, or as Data Connect writes it, which a hand-made address may hold
const UUID_PATTERN = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})$/i

type ConversationRouteSearch = {
  // A draft at the id the conversation will have, opened by a "New conversation" button
  isNew?: true
  // A subagent of the conversation whose work is open over its page
  subagent?: string
}

/*
  What a conversation's page reads of its query: whether it is a draft, and the subagent whose work
  is open, a UUID. Every key is written, `undefined` for one that is not what it should be, since
  TanStack lays what `validateSearch` returns over the raw query rather than replacing it
*/
function parseConversationSearch(search: Record<string, unknown>): ConversationRouteSearch {
  return {
    isNew: search.isNew === true ? true : undefined,
    subagent: typeof search.subagent === 'string' && UUID_PATTERN.test(search.subagent) ? search.subagent : undefined,
  }
}

export { type ConversationRouteSearch }

export default parseConversationSearch
