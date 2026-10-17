import { IS_PRODUCTION } from '~constants'

import {
  CONVERSATION_REQUEST_SETTINGS,
  type ConversationRequestSettings,
} from '~domain/agent/conversationRequestSettings'

/*
  What a subagent's requests are answered by, its own to choose, as David chose on 2026-10-16: a
  subagent's thinking is bound to its own conversation, so a subagent on another model changes
  nothing of its parent's. Opus 5.5 at medium effort, as a conversation's, until David chooses from
  what M33's measurement (`measure:subagents`) found. A change of it is a change of the subagent's
  request alone, as its tools and system prompt are pinned beside it
*/
export const SUBAGENT_REQUEST_SETTINGS: ConversationRequestSettings = CONVERSATION_REQUEST_SETTINGS

// The settings the measurement runs a subagent with, as JSON, which nothing but the script sets
const OVERRIDE_VARIABLE = 'SUBAGENT_REQUEST_SETTINGS'

/*
  The settings a subagent's run sends: its own, or outside production those the measurement script
  sets in this process's environment, read at each run, so one process measures each configuration
  in turn
*/
function readSubagentRequestSettings(): ConversationRequestSettings {
  const override = IS_PRODUCTION ? undefined : process.env[OVERRIDE_VARIABLE]

  if (!override) return SUBAGENT_REQUEST_SETTINGS

  return { ...SUBAGENT_REQUEST_SETTINGS, ...(JSON.parse(override) as Partial<ConversationRequestSettings>) }
}

export default readSubagentRequestSettings
