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

/*
  One of Strategy Dance's own tools, as a run's worker runs it: the name Claude calls it by, whether
  it only reads, which lets it run beside the reads next to it, and what it does with a call's
  input, as the run's member. It answers what goes back to Claude, as JSON, or throws an error whose
  message is a sentence Claude can act on. It checks its input itself, since Claude's input streams
  in unchecked
*/
export type ConversationToolRunner = {
  name: string
  isReadOnly: boolean
  run(
    input: unknown,
    context: { signal: AbortSignal; reference: ConversationRunReference; toolUseId: string },
  ): Promise<unknown>
}

/*
  What a run asks Claude through: a request streamed until its final message, the progress lines
  its thinking gives along the way handed over as they land, and a request's input counted. The
  real one calls Anthropic's API; a placeholder and the tests' scripted double stand in for it
*/
export type ClaudeClient = {
  stream(
    body: BetaMessageStreamParams,
    options: {
      signal: AbortSignal
      onProgress: (line: string) => void
      // The message so far, each time the stream reports its usage, so a stream that fails partway
      // is charged what it used
      onUsage?: (message: BetaMessage) => void
    },
  ): Promise<BetaMessage>
  countTokens(body: MessageCountTokensParams): Promise<number>
}

/* ---
  KNOWLEDGE
--- */

// An edit pushed to a document's text since its snapshot, as its `DocumentUpdate` row holds it: a Yjs update in base64
export type KnowledgeDocumentUpdate = {
  id: string
  payload: string
}

// A document's shared text once it is seeded: its snapshot, in base64, and the updates pushed since
export type SeededKnowledgeDocumentText = {
  state: string
  updates: KnowledgeDocumentUpdate[]
}

/*
  A document's shared text as its row holds it: the snapshot, null until somebody seeds it, the
  updates pushed since, and the copy of the text the last compaction wrote, which a document with
  no snapshot is seeded from
*/
export type StoredKnowledgeDocumentText = Omit<SeededKnowledgeDocumentText, 'state'> & {
  state: string | null
  content: string
}

// A top-level block of a document's shared text, as an agent reads it: the id an edit names it by, and its Markdown
export type KnowledgeDocumentBlock = {
  id: string
  markdown: string
}

// An edit an agent makes to a document's shared text, the blocks it writes in Markdown
export type KnowledgeDocumentEdit =
  /** The whole text replaced */
  | { type: 'content'; markdown: string }
  /** Blocks added after the last one */
  | { type: 'append'; markdown: string }
  /** The top-level blocks from one id to another, both included, replaced */
  | { type: 'replaceBlocks'; fromId: string; toId: string; markdown: string }
  /** A piece of text that occurs exactly once, replaced */
  | { type: 'replaceText'; find: string; replace: string }
