import type { BetaMessageStreamParams, BetaTool } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import CONVERSATION_TOOLS from '~domain/agent/conversationTools'

export type ConversationRequestTools = NonNullable<BetaMessageStreamParams['tools']>

/*
  The tools a run's requests send: the agent's own, then the tools of the modules it uses, as the
  run's worker listed them, in `CONVERSATION_MODULES`' order. The same list for every conversation,
  since each module's tools are its code's, so a release that changes them changes it once for all,
  as it would the system prompt
*/
function buildConversationTools(moduleTools: BetaTool[]): ConversationRequestTools {
  return [...CONVERSATION_TOOLS, ...moduleTools]
}

export default buildConversationTools
