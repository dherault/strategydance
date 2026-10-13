import { IS_CONVERSATION_AGENT_PLACEHOLDER } from '~constants'

import createAnthropicClaudeFiles from '~domain/agent/createAnthropicClaudeFiles'
import createPlaceholderClaudeFiles from '~domain/agent/createPlaceholderClaudeFiles'

// Where the files sent in conversations go: Anthropic's Files API, unless development asked for the
// placeholder (`IS_CONVERSATION_AGENT_PLACEHOLDER`), as `conversationClaudeClient` does
const conversationClaudeFiles = IS_CONVERSATION_AGENT_PLACEHOLDER
  ? createPlaceholderClaudeFiles()
  : createAnthropicClaudeFiles()

export default conversationClaudeFiles
