import { IS_CONVERSATION_AGENT_PLACEHOLDER } from '~constants'

import createAnthropicClaudeClient from '~domain/agent/createAnthropicClaudeClient'
import createPlaceholderClaudeClient from '~domain/agent/createPlaceholderClaudeClient'

// The client every run asks: Claude, through Anthropic's API, unless development asked for the
// placeholder (`IS_CONVERSATION_AGENT_PLACEHOLDER`)
const conversationClaudeClient = IS_CONVERSATION_AGENT_PLACEHOLDER
  ? createPlaceholderClaudeClient()
  : createAnthropicClaudeClient()

export default conversationClaudeClient
