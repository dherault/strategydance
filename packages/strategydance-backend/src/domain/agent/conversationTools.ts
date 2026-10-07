import type { BetaMessageStreamParams } from '@anthropic-ai/sdk/resources/beta/messages/messages'

/*
  The tools every conversation's requests send, the same list in the same order for all of them,
  since a change to it, like one to the system prompt, makes existing conversations lose their
  earlier reasoning once. Today Claude's own web search, which filters what it fetches before it
  reaches the context, at most five searches a request. Later milestones append theirs
*/
const CONVERSATION_TOOLS: NonNullable<BetaMessageStreamParams['tools']> = [
  { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
]

export default CONVERSATION_TOOLS
