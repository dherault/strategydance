import type {
  BetaMessage,
  BetaMessageStreamParams,
  MessageCountTokensParams,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'
import type { ModuleScope } from 'strategydance-core'
import type { CompanyAspect, TaskStatus } from 'strategydance-database/backend'

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

/* ---
  MODULES
--- */

/*
  Who calls a module, verified before its server is built, and never from a tool's arguments: the
  member a run acts as, for Strategy Dance's agent, or a member's connection, for an agent of their
  own. `membershipCreatedAt` is the membership's as it was verified, so a member removed, or removed
  and invited back, stops every agent acting as them at its next call. `idempotencyScope` is what
  their keys are kept under, `conversation:<id>` for the agent and `connection:<id>` for an external
  one, so two clients choosing the same key never meet
*/
export type ModuleCaller = {
  kind: 'agent' | 'external'
  userId: string
  organizationId: string
  membershipCreatedAt: string
  scopes: ModuleScope[]
  idempotencyScope: string
}

// A write a module was called for under an idempotency key: the key, the tool, and a hash of its
// arguments, which a call sent again under the key has to match
export type ModuleCall = {
  key: string
  tool: string
  argumentsHash: string
}

/* ---
  KNOWLEDGE MODULE
--- */

/*
  Why the Knowledge module refused a call, which its tool words for the model: each is something the
  model can act on, by telling the member, reading the document again, or changing what it sent
*/
export type KnowledgeRefusal =
  /** The caller is no longer the member the module was built for */
  | { outcome: 'notMember' }
  /** The caller's connection may read but not write */
  | { outcome: 'readOnly' }
  /** No document by that id in the organization, or one deleted */
  | { outcome: 'notFound' }
  /** The team keeps the document from agents */
  | { outcome: 'keptFromAi' }
  /** The team keeps agents from changing the document */
  | { outcome: 'closedToAi' }
  /** The text changed since the agent read it: a block it named is gone, or the version moved */
  | { outcome: 'changed' }
  /** A whole text replaced without the version a read gave */
  | { outcome: 'versionRequired' }
  /** The organization keeps as many documents as it may */
  | { outcome: 'full' }
  /** A document keeps a title or some text, from its start */
  | { outcome: 'empty' }
  /** The edit would take the document past what it may hold */
  | { outcome: 'contentTooLong' }
  | { outcome: 'stateTooLong' }
  /** The text to replace does not occur, or occurs more than once */
  | { outcome: 'textNotFound' }
  | { outcome: 'textNotUnique'; count: number }
  /** A block range whose first block comes after its last */
  | { outcome: 'invalidRange' }
  /** The document holds something the edit cannot be applied to as it stands */
  | { outcome: 'unreadable' }
  /** The edit would build a document the editor cannot hold */
  | { outcome: 'invalidEdit' }
  /** A restore of a document deleted over a day ago, or one not deleted */
  | { outcome: 'goneForGood' }
  | { outcome: 'notDeleted' }
  /** An idempotency key sent before with another call */
  | { outcome: 'keyConflict' }
  /** A cursor no read gave */
  | { outcome: 'invalidCursor' }

// What a write of the Knowledge module answers: its result, or the one stored under its key when the
// call was sent before, or why it was refused
export type KnowledgeWriteResult<Result> =
  | { outcome: 'written'; result: Result }
  | { outcome: 'answered'; result: unknown }
  | KnowledgeRefusal

// What each of the Knowledge module's tools is registered with: who calls it, and the web address of
// a document for an external caller, whose results carry them, undefined for Strategy Dance's agent
export type KnowledgeToolContext = {
  caller: ModuleCaller
  toAddress: (documentId: string) => Promise<string | undefined>
}

/* ---
  TASKS MODULE
--- */

// A live task as the Tasks module reads the board, without its description: what it waits on among
// the live tasks, and its count of every link, those to deleted tasks included
export type BoardTask = {
  id: string
  name: string
  status: TaskStatus
  position: number
  assigneeId: string | null
  isAssignedToAgent: boolean
  dueDate: string | null
  aspects: CompanyAspect[]
  createdAt: string
  updatedAt: string
  dependencyIds: string[]
  linkCount: number
}

// A member of the organization, by name, which is null for one who never gave one
export type BoardMember = {
  id: string
  name: string | null
}

// The live board and the team, as every tool of the Tasks module reads them
export type TaskBoard = {
  tasks: BoardTask[]
  members: BoardMember[]
}

// A task named in an answer or a refusal: its id and its name
export type TaskReference = {
  id: string
  name: string
}

// Who does a task, as the board's assignment select names it, which the module reads and writes alike,
// with `"me"`, the caller, for the module to read
export type TaskAssignee = 'agent' | 'unassigned' | `member:${string}`

/*
  Why the Tasks module refused a call, which its tool words for the model: each is something the
  model can act on, by telling the member, reading the task again, or changing what it sent
*/
export type TasksRefusal =
  /** The caller is no longer the member the module was built for */
  | { outcome: 'notMember' }
  /** The caller's connection may read but not write */
  | { outcome: 'readOnly' }
  /** No live task by that id on the board */
  | { outcome: 'notFound' }
  /** A task assigned to somebody who is not a member of the organization */
  | { outcome: 'assigneeNotMember' }
  /** The board keeps as many tasks as it may */
  | { outcome: 'full' }
  /** The description changed since the agent read it */
  | { outcome: 'changed' }
  /** A description replaced without the version a read gave */
  | { outcome: 'versionRequired' }
  /** A description past what a task holds once stored */
  | { outcome: 'descriptionTooLong' }
  /** A move before a task that is not in the column it names */
  | { outcome: 'notInColumn' }
  /** A move into a gap too narrow for a float */
  | { outcome: 'noRoom' }
  /** An update other writes kept landing before, every time it was read again */
  | { outcome: 'busy' }
  /** A link from a task to itself, one that would close a loop, or one past the 50 a task holds */
  | { outcome: 'selfDependency' }
  | { outcome: 'loop'; tasks: TaskReference[]; length: number }
  | { outcome: 'tooManyDependencies' }
  /** A link removed that is not there */
  | { outcome: 'notLinked' }
  /** A restore of a task not deleted, of one deleted over a day ago, or one whose links would loop */
  | { outcome: 'notDeleted' }
  | { outcome: 'goneForGood' }
  | { outcome: 'restoreLoop'; tasks: TaskReference[]; count: number }
  /** An idempotency key sent before with another call */
  | { outcome: 'keyConflict' }
  /** A cursor no list gave */
  | { outcome: 'invalidCursor' }

// What a write of the Tasks module answers: its result, or the one stored under its key when the call
// was sent before, or why it was refused
export type TasksWriteResult<Result> =
  | { outcome: 'written'; result: Result }
  | { outcome: 'answered'; result: unknown }
  | TasksRefusal

// What each of the Tasks module's tools is registered with: who calls it, and the web address of a
// task for an external caller, whose results carry them, undefined for Strategy Dance's agent
export type TasksToolContext = {
  caller: ModuleCaller
  toAddress: (taskId: string) => Promise<string | undefined>
}
