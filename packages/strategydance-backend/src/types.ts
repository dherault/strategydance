import type {
  BetaMessage,
  BetaMessageStreamParams,
  MessageCountTokensParams,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'

export type { ApiErrorResponse, ApiResponse, ApiSuccessResponse } from 'strategydance-core'

/* ---
  REQUEST AUGMENTATION
--- */

// Who is calling, as their verified ID token says
export type Viewer = {
  id: string
  email: string | null
}

declare module 'express' {
  interface Request {
    // Set by `authenticationMiddleware`, and only by it
    viewer?: Viewer
  }
}

/* ---
  CONVERSATIONS
--- */

/*
  A content block of a conversation's transcript, as Claude's API writes and reads one: its type,
  and whatever fields that type has, in the order they came in, since a turn is replayed byte for
  byte
*/
export type ConversationContentBlock = {
  type: string
  [field: string]: unknown
}

// The block a member's message and a reply's text are written in
export type ConversationTextBlock = {
  type: 'text'
  text: string
}

// A run, by its conversation, its author and its organization, which every operation on it is
// keyed by, so a worker told of a run elsewhere finds nothing
export type ConversationRunReference = {
  organizationId: string
  userId: string
  conversationId: string
  runId: string
}

// What every write of the worker that claimed a run is fenced on: the attempt it claimed, and the
// membership the run was started under
export type ConversationRunFence = ConversationRunReference & {
  attempts: number
  membershipCreatedAt: string
}

// What the agent answers a run's turn with: its content blocks, as the API answered them
export type ConversationAgentTurn = {
  content: ConversationContentBlock[]
}

/*
  What answers a conversation: given the transcript's last entry, the member's message, it answers
  a turn, reporting the progress lines it has along the way, and gives up when the signal aborts,
  which a worker that lost its run does
*/
export type ConversationAgent = {
  respond(input: {
    lastEntry: ConversationContentBlock[]
    signal: AbortSignal
    onStep: (step: string) => void
  }): Promise<ConversationAgentTurn>
}

/*
  What a run asks Claude through: a request streamed until its final message, the progress lines
  its thinking gives along the way handed over as they land, and a request's input counted. The
  real one calls Anthropic's API; a placeholder and the tests' scripted double stand in for it
*/
export type ClaudeClient = {
  stream(
    body: BetaMessageStreamParams,
    options: { signal: AbortSignal; onProgress: (line: string) => void },
  ): Promise<BetaMessage>
  countTokens(body: MessageCountTokensParams): Promise<number>
}
