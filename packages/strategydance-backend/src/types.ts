import type {
  BetaMessage,
  BetaMessageStreamParams,
  BetaTool,
  MessageCountTokensParams,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'
import type { ModuleScope } from 'strategydance-core'
import type { CompanyAspect, TaskStatus } from 'strategydance-database/backend'
import type {
  Directory,
  DirectoryBusinessModel,
  DirectoryCategory,
  DirectoryInactiveReason,
  InactiveDirectory,
} from 'strategydance-directories'

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

// A file sent in a conversation, by what finds everything it left: its id, its conversation, author
// and organization, and its id in the Files API once it has one
export type ConversationAttachmentReference = {
  id: string
  userId: string
  organizationId: string
  conversationId: string
  claudeFileId?: string | null
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
  The modules a run's agent uses, as its worker connected to them for the run's member: their tools
  as Claude takes them, which the run's requests send after the agent's own, the runners that call
  them, and what lets go of the connections once the run is done
*/
export type ConversationModules = {
  tools: BetaTool[]
  runners: ConversationToolRunner[]
  close(): Promise<void>
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

// A file Claude's Files API holds, as its listing says: its id, the name it was uploaded under and
// when, in RFC 3339
export type ClaudeFile = {
  id: string
  name: string
  createdAt: string
}

/*
  Where the files sent in conversations go so Claude reads them by reference: Anthropic's Files API,
  which keeps a file until it is deleted. An upload answers the file's id; deleting a file that is
  gone already counts as deleting it; the listing goes through every file of the workspace, newest
  first. The real one calls the API; a placeholder and the tests' fake stand in for it
*/
export type ClaudeFiles = {
  upload(file: { name: string; contentType: string; bytes: Uint8Array }): Promise<string>
  delete(id: string): Promise<void>
  list(): AsyncIterable<ClaudeFile>
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
  /** An external agent's search past the member's search allowance, until the next one fits */
  | { outcome: 'tooManySearches'; retryAfterMs: number }

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
  /** An external agent's query past the member's search allowance, until the next one fits */
  | { outcome: 'tooManySearches'; retryAfterMs: number }

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

/* ---
  DIRECTORIES

  The daily check of the directories package's lists, `domain/directories/`
--- */

// Both lists of the directories package, as a check reads and writes them
export type DirectoryLists = {
  directories: Directory[]
  inactiveDirectories: InactiveDirectory[]
}

/*
  What a page answered a probe with: a page (`reachable`), a page that is not there (`missing`, a
  404 or a 410), a wall put up for bots (`blocked`: a 401, a 403, a 429, a challenge, a redirect
  loop a visitor without cookies meets), no site (`unreachable`: no such name, a name resolving to a
  private address, a refused or dropped connection, a failed TLS handshake, the deadline, a server
  error), or something nobody can tell apart from a passing fault (`unknown`)
*/
export type DirectoryPageOutcome = 'reachable' | 'missing' | 'blocked' | 'unreachable' | 'unknown'

// One page a probe fetched, and the text a reader of it would see
export type DirectoryPageProbe = {
  url: string
  // Where its redirects led, null when nothing answered
  finalUrl: string | null
  status: number | null
  outcome: DirectoryPageOutcome
  // Why it is not `reachable`, for the logs and the report
  failure: string | null
  title: string
  description: string
  text: string
  // The pages of the same site it links to
  links: string[]
  // Whether it holds too little text to be read without running its scripts, as a page a browser
  // draws does: what it says it lacks proves nothing
  isClientRendered: boolean
}

export type DirectoryProbe = {
  root: DirectoryPageProbe
  // The submission page's, null when it is the root itself
  submission: DirectoryPageProbe | null
}

// A page a check read, by this server's probe or Claude's web fetch, at its address
export type DirectoryPage = {
  url: string
  text: string
}

// The quote, and the page it was read on, that a business model or a verdict of inactive rests on
export type DirectoryEvidence = {
  quote: string
  url: string
}

// Claude's answer, as the review's schema has it and its reader checked it
export type DirectoryReviewAnswer = {
  verdict: 'ACTIVE' | 'INACTIVE' | 'INCONCLUSIVE'
  inactiveReason: DirectoryInactiveReason | null
  description: string | null
  isCurrentDescriptionAccurate: boolean
  // Once each, in the enum's order, null when the answer named none
  categories: DirectoryCategory[] | null
  areCurrentCategoriesAccurate: boolean
  businessModel: DirectoryBusinessModel | null
  evidence: DirectoryEvidence | null
  submissionUrl: string | null
  notes: string
}

// What a check's requests used, summed over a review's paused parts
export type DirectoryCheckUsage = {
  inputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
  outputTokens: number
}

/*
  What became of a review: an answer, with the pages Claude's fetches brought back, which its quotes
  are checked against; no answer worth reading, a refusal, an answer past its schema or the
  deadline, which counts as a check that told nothing; or a failure of the API itself, which counts
  as no check at all
*/
export type DirectoryReview =
  | { outcome: 'answered'; answer: DirectoryReviewAnswer; fetchedPages: DirectoryPage[]; usage: DirectoryCheckUsage }
  | { outcome: 'unanswered'; failure: string; usage: DirectoryCheckUsage }
  | { outcome: 'failed'; failure: string; usage: DirectoryCheckUsage }

// One directory's check, before it is applied to the lists
export type DirectoryCheck = {
  name: string
  // The entry as it was checked, so a check is applied to that entry alone, never to one somebody
  // changed meanwhile
  directory: Directory | InactiveDirectory
  probe: DirectoryProbe
  // Null when the probe alone decided, a site it could not reach
  review: DirectoryReview | null
  // The moved submission page the review named, as a probe of it answered, or null
  submissionProbe: DirectoryPageProbe | null
}

/*
  What a check did to a directory: kept it active, moved it to the other list, kept it inactive,
  counted it unreachable without moving it yet, learned nothing (`inconclusive`), or left it as it
  was, for an API failure or a run out of time (`notChecked`)
*/
export type DirectoryCheckResult =
  | 'active'
  | 'movedToInactive'
  | 'movedToActive'
  | 'inactive'
  | 'unreachable'
  | 'inconclusive'
  | 'notChecked'

export type DirectoryCheckOutcome = {
  name: string
  rootUrl: string
  result: DirectoryCheckResult
  // What changed in its entry, a line each, for the report
  changes: string[]
  evidence: DirectoryEvidence | null
  notes: string
}

/* ---
  GITHUB
--- */

/*
  GitHub's API as one token: a REST call answered with its status and its body, JSON or text as
  GitHub sends it, a status outside 2xx thrown but those the caller handles, and a GraphQL query
  answered with its data. The real one calls GitHub; the tests' fake keeps a repository in memory
*/
export type GitHubClient = {
  request(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    options?: { body?: unknown; accept?: string; allowedStatuses?: number[] },
  ): Promise<{ status: number; data: unknown }>
  graphql<Data>(query: string, variables: Record<string, unknown>): Promise<Data>
}
