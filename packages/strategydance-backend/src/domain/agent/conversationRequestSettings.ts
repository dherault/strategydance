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

/*
  What a run's requests are answered by: the model, the effort it thinks at, and the task budget it
  paces a loop by, in tokens, which none takes but a subagent measured with one. A conversation's
  are today's, and a subagent's its own (`SUBAGENT_REQUEST_SETTINGS`), since its thinking is bound
  to its own conversation and its cached prefix shared with other subagents alone
*/
export type ConversationRequestSettings = {
  model: string
  effort: 'low' | 'medium' | 'high'
  taskBudget: number | null
}

export const CONVERSATION_REQUEST_SETTINGS: ConversationRequestSettings = {
  model: CONVERSATION_MODEL,
  effort: 'medium',
  taskBudget: null,
}

// The beta a request with a task budget takes besides the others
export const TASK_BUDGET_BETA = 'task-budgets-2026-03-13'

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
