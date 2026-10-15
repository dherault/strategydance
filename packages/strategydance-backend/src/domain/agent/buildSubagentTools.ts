import type { BetaTool } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import type { ConversationRequestTools } from '~domain/agent/buildConversationTools'
import { WEB_SEARCH_TOOL } from '~domain/agent/conversationTools'

/*
  The tools a subagent's requests send: web search, then the tools of the modules its agent uses, as
  the run's worker listed them, in `CONVERSATION_MODULES`' order. Everything the agent that launched
  it has but `ask_user`, since nobody is there to answer, and, for now, the integration tools, whose
  calls wait for an approval nobody can give a subagent. The same list for every subagent, so their
  requests share a cached prefix, which a list granted per launch would split
*/
function buildSubagentTools(moduleTools: BetaTool[]): ConversationRequestTools {
  return [WEB_SEARCH_TOOL, ...moduleTools]
}

export default buildSubagentTools
