import { IS_PRODUCTION } from '~constants'

import type { ConversationRunLimits } from '~domain/conversations/requestConversationTurn'

// The limits the measurement runs a subagent's runs at, as JSON, which nothing but the script sets
const OVERRIDE_VARIABLE = 'SUBAGENT_RUN_LIMITS'

/*
  The limits a subagent's run keeps where they differ from a conversation's run: nowhere, or outside
  production those the measurement script sets in this process's environment, read at each run, so a
  brief made to run long reaches its fourth run within minutes and a few dollars
*/
function readSubagentRunLimits(): Partial<ConversationRunLimits> {
  const override = IS_PRODUCTION ? undefined : process.env[OVERRIDE_VARIABLE]

  if (!override) return {}

  return JSON.parse(override) as Partial<ConversationRunLimits>
}

export default readSubagentRunLimits
