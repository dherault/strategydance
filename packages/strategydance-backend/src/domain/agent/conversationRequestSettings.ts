/* ---
  What every request of a conversation's run sends, as M1's probe settled it (`probe:claude`)
--- */

export const CONVERSATION_MODEL = 'claude-opus-5-5'

// Thinking counts toward it, and a request is streamed, so it can be this high
export const CONVERSATION_MAX_TOKENS = 64000

/*
  The betas the request takes: thinking's progress lines (`display: "updates"`), what a replay does
  with a thinking block whose history changed (`block_binding`), and the fallback model the API
  runs a refused request on
*/
export const CONVERSATION_BETAS = [
  'thinking-display-updates-2026-08-18',
  'thinking-binding-controls-2026-08-01',
  'server-side-fallback-2026-07-01',
] as const

// How many times a turn web search's server-side loop paused is sent back to carry on
export const MAX_CONVERSATION_PAUSES = 5

/* ---
  What the request that tags a conversation with its aspects sends, beside the run's own
--- */

// Its thinking, at low effort, and its answer, a few aspects, fit well inside it
export const CONVERSATION_TAGGING_MAX_TOKENS = 8000

// The fallback model the API runs a refused request on, as the run's own requests have it
export const CONVERSATION_TAGGING_BETAS = ['server-side-fallback-2026-07-01'] as const

// How many aspects the agent tags a conversation with at most
export const MAX_CONVERSATION_TAGGED_ASPECTS = 3

// How much of the member's message, and of the reply, the request quotes, in characters
export const MAX_CONVERSATION_TAGGING_TEXT_LENGTH = 8000
