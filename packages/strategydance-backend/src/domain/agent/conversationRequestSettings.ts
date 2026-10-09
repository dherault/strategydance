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
