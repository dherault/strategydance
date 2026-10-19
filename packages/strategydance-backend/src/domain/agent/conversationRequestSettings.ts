/* ---
  What every request of a conversation's run sends, as M1's probe settled it (`probe:claude`)
--- */

export const CONVERSATION_MODEL = 'claude-opus-5-5'

// Thinking counts toward it, and a request is streamed, so it can be this high
export const CONVERSATION_MAX_TOKENS = 64000

/*
  The list prices of every model a request can name or be answered by, in dollars per million tokens,
  which is microdollars a token: its own input, its output, what it reads from the prompt cache and
  what it writes to it for five minutes, as the claude-api skill gave them on 2026-10-18. The cost
  limit a run prices its ledger with them, and the credits will. A model a request names, or a
  fallback the API may answer one with (`CLAUDE_FALLBACK_MODELS`), joins it before a request names
  it: a test holds every one to it, and one missing is priced as the dearest
*/
export type ClaudeModelPrice = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export const CLAUDE_MODEL_PRICES: Record<string, ClaudeModelPrice> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  // Its rates for a prompt of 100000 tokens or fewer, five times them past that: only the tagging
  // request names it, whose prompt quotes 8000 characters of each side of an exchange
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
}

/*
  How fast each model can write at most, in output tokens a second, which bounds what a stream cut
  partway was billed: nothing reports a request's output before its end, and its reasoning, billed
  in full, is never streamed, so the time it streamed is what says how much it wrote. Provisional,
  a few times what a model writes, until `probe:claude` measures each and holds them to it. A model
  missing has a cut stream counted at its whole reservation
*/
export const CLAUDE_MAX_OUTPUT_TOKENS_PER_SECOND: Record<string, number> = {
  'claude-opus-5-5': 400,
  'claude-sonnet-5-5': 400,
  'claude-opus-5': 400,
  'claude-opus-4-8': 400,
  'claude-sonnet-5': 400,
  'claude-haiku-5-5': 1000,
}

// How long past the cut a model may go on writing before the API sees the stream gone
export const CUT_STREAM_GRACE_MS = 5000

/*
  The models the API may answer a refused request with, under `fallbacks: "default"`, by the model
  the request names: its `allowed_fallback_models`, which `probe:claude` reads and holds this to.
  The cost limit reserves a request's fallback at the dearest of them
*/
export const CLAUDE_FALLBACK_MODELS: Record<string, string[]> = {
  'claude-opus-5-5': ['claude-opus-5', 'claude-opus-4-8'],
  'claude-sonnet-5-5': ['claude-sonnet-5'],
  // None: the API offers no server-side fallback for it, so a request naming it sends none
  'claude-haiku-5-5': [],
}

// What one web search costs, a hundredth of a dollar, in microdollars
export const WEB_SEARCH_PRICE_MICRODOLLARS = 10_000

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

/*
  The model it asks, as David chose on 2026-10-18 after the review of M1 to M38: picking three
  aspects of nine needs no Opus, and the run holds its conversation while it goes, so a faster model
  lets the member send their next message sooner. It has no server-side fallback, so a refusal leaves
  the conversation untagged, as any failure of the request does
*/
export const CONVERSATION_TAGGING_MODEL = 'claude-haiku-5-5'

// Its thinking, at low effort, and its answer, a few aspects, fit well inside it
export const CONVERSATION_TAGGING_MAX_TOKENS = 8000

// How many aspects the agent tags a conversation with at most
export const MAX_CONVERSATION_TAGGED_ASPECTS = 3

// How much of the member's message, and of the reply, the request quotes, in characters
export const MAX_CONVERSATION_TAGGING_TEXT_LENGTH = 8000
