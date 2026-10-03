# Conversations

How Strategy Dance's conversation agents get built: what the design asks for, the decisions taken,
the architecture, and twenty milestones that take the feature from nothing to launch, each one pull
request into `dev` that a Claude Code session can implement from this document.

Written on 2026-10-02 against `dev` at `4def3a6`, from the Claude Design project "Strategy Dance
Conversations". When a milestone merges, write its pull request number in the milestone table. When a
decision changes, change it here first.

## The design

The design is a Claude Design export, kept out of the repository since `documents/` keeps only
Markdown. On David's machine it sits at `~/Downloads/Strategy Dance Conversations/`. This document
restates what each milestone needs, so a session without the export can still build it; with the
export, port the styles from `conversations.css` onto the design system's components, as
`CLAUDE.md` asks: keep the design's props and wording, build on the shadcn component.

| File in the export | What it holds |
| --- | --- |
| `pages/Conversations.jsx` | The list, the conversation page, the aspect page section |
| `pages/ConversationThread.jsx` | The thread: messages, tool calls, questions, notes, thinking indicator, composer |
| `pages/ConversationDock.jsx` | The dock of chat windows |
| `conversations-data.js` | Seed conversations, the suggestion catalogue, and the behaviour of send, stop, resume, retry, answer, titles and previews |
| `conversations.css` | Every `cv-` class: sizes, spacing, states, animations |
| `pages/Integrations.jsx` | The Integrations page and its catalogue of MCP servers |
| `routes.jsx`, `App.html` | The sidebar groups, and where the dock mounts |
| `assets/mcp/*.svg` | The catalogue's server marks |

## Decisions

| Topic | Decision |
| --- | --- |
| Model | Claude Opus 5.5, `claude-opus-5-5` |
| Where it runs | Gemini Enterprise Agent Platform (Vertex AI), through `@anthropic-ai/vertex-sdk`, region `global`, with Application Default Credentials: nothing stored, billed through Google Cloud |
| How a run executes | In the background. The backend queues a Cloud Tasks task, and the task's request runs the agent loop on the backend, writing each step to Data Connect. Locally it runs in-process |
| What the agent reads | Knowledge, the organization's profile (name, brief), the whole team (names, job titles, roles, bios, top priorities) and the log. Not tasks or the checklist, which are going away |
| What the agent writes | Knowledge documents, never one whose AI lock is on, and the member's own top priority. Not the log, the checklist or tasks |
| Web search | Claude's built-in web search, `web_search_20250305` (the version Vertex offers), from the first agent milestone |
| Attachments | Images, PDFs and text files, read by Claude natively |
| Questions | Multiple-choice questions through a tool, as designed |
| Replies | Whole messages, as designed. The thinking indicator shows live progress. No token streaming to the browser |
| Integrations (MCP) | The last milestones. Administrators choose the organization's servers. Each member connects their own account to an OAuth server, and the agent acts as them. A key-based server's one key serves the whole organization. Every integration call waits for the member's approval, except the tools an administrator has allowed to run without it |
| Usage limits | None yet: a credit system comes later. Every run records its token usage for it. Per-run safety limits on steps and duration stay, and so do bounds on how much runs at once (three runs per member in each organization, fifty dispatches across the queue), which cap concurrency rather than usage |
| Agent-started conversations | Not in this plan. Orchestration comes later |
| Rollout | Strategy Dance administrators only (`User.isAdministrator`) until the final milestone opens it to everyone |
| Pull requests | Small, one concern each |

## What the design asks for

### Navigation

- The sidebar gains a "Reflection" group after "Aspects", holding **Conversations** and
  **Knowledge**, which moves out of "Aspects". Conversations carries a badge counting the
  conversations waiting for an answer.
- "Company" gains **Integrations**, in the MCP milestones.
- Conversations are private: only their author sees them, administrators included. Each
  organization has its own.

### The list, `/conversations`

- Header "Conversations", lead "Chats with Strategy Dance. Get ready to be challenged. Only you can
  see your conversations.", and a primary "New conversation" button.
- A search field ("Search conversations", Escape clears it). Every word has to appear in the title
  or in one message, ignoring case. (The prototype also matched words spread over several messages;
  the full-text search `SearchConversations` uses matches within one title or one message.) No match:
  "No conversations match “query”", "Search looks at titles and messages.", and a "Clear search"
  button.
- A table, latest activity first. Columns: Conversation (the title as a link, a "Needs your answer"
  badge when a question waits, and a one-line preview), Aspects (their icons, in `COMPANY_ASPECTS`
  order), Updated (relative time), and actions: "Open in dock" on desktop, and Delete, which asks to
  confirm and then offers Undo in a toast. A click anywhere on the row opens the conversation.
- Empty: "No conversations yet", "Ask Strategy Dance about a decision, a plan or what to do next.",
  and the New conversation button.

### The conversation page, `/conversations/$conversationId`

- A bar: "All conversations" back to the list; a "Private" lock with the tooltip "Only you can see
  your conversations"; "Updated 5 min ago", or "Not saved until you send a message" for a draft;
  and, on desktop once saved, an "Open in dock" button that docks it and goes back to the list.
- The title in the display face (`text-4xl`), then the aspects as icons, or "Add aspects": a button
  that opens the aspects dialog (the knowledge one, shared).
- The thread, in a 768px column, and the composer stuck to the bottom of the page.
- A conversation that does not exist: "This conversation no longer exists", "It was deleted, or the
  link is out of date."

### The thread

Each entry is one of:

- **The member's message**: a grey bubble on the right, line breaks kept, links and knowledge
  mentions drawn; attachments above it, images as thumbnails (a click opens them in a dialog with
  their name and size), other files as chips with an icon, the name and the size.
- **Strategy Dance's text**: full width, Markdown limited to paragraphs, bulleted and numbered lists,
  tables, bold, italic and links. A link to knowledge, `[title](doc:<id>)`, shows the document's
  current title with a file icon; a deleted one is struck through and muted.
- **A tool call**: a bordered row with an icon (a spinner while it runs, a plug for an integration,
  a wrench otherwise), the label or the server's name, a "Tool" or "MCP" badge, and under it the
  tool's name in mono with its status ("Running", "Failed", "Cancelled"). Finished calls offer "View
  output" or "View error": a dialog with the call's input and output as formatted JSON, its time and
  duration, and a copy button. Consecutive calls stack without a gap. An integration that cannot
  run shows a warning strip under the row (the MCP milestones).
- **A question**, waiting: "Waiting for your answer", the prompt, "Select one" or "Select all that
  apply", the options as radios or checkboxes, a last option with a "Write your own answer" field,
  and "Send answer". Answered: "Answered" with a check, the chosen options ticked and the rest
  muted, the member's own answer marked "Your own answer". Skipped: "Skipped", everything muted.
- **An aspects note**, centred and small: "Strategy Dance tagged this conversation", "You changed
  the aspects" or "You removed all aspects", then the aspects as small chips.
- **A note**, centred and small, such as "You stopped this response." When it is the last entry and
  nothing runs, a stopped note offers "Resume" and "Retry".
- **The thinking indicator**, while a run is going: the mark pulsing, the current step shimmering,
  the elapsed time on the right (`12s`, `1m 05s`). Without motion when the reader asks for less.

An empty thread says "Ask about your company, a decision, or what to do next. Type @ to mention
knowledge."

### The composer

- A textarea that grows from one line to 160px: "Message Strategy Dance". Enter sends, Shift+Enter
  breaks the line, nothing sends while an input method is composing.
- A "+" menu: "Files and images", and "Mention knowledge", which inserts an `@`.
- Typing `@` opens a "Knowledge" list of up to six documents whose title matches, latest first,
  driven by the arrows, Enter or Tab to pick, Escape to close; "No knowledge matches “query”" when
  none does. A pick inserts `@Title`, sent as `[Title](doc:<id>)` with `[`, `]` and `\` in the title
  escaped, since a title may hold any character; the link draws the document's current title from
  its id anyway.
- Attachments: up to ten per message, picked or pasted, shown in a tray above the field with a
  remove button each.
- Send is disabled when there is nothing to send. While a run goes, a Stop button replaces it.
- Sending while a question waits skips the question.

### The dock

Desktop only (768px and up): chat windows pinned to the bottom right, the last opened rightmost.

- A window is 352px wide and `min(520px, 100vh - 48px)` tall when open, its header alone when
  minimized. The header's button toggles it and shows the mark and the title; minimized, it also
  shows a spinner while a run goes, the count of unread replies, or a dot for a waiting question.
  Its actions: "Full page", "Minimize", "Close". Escape minimizes the window it is in. Opening a
  window focuses its composer.
- As many windows as fit beside the sidebar; the rest sit behind a "+N" button whose menu lists
  them, with a dot when any needs attention.
- "Open in dock" (the list, the page, a card) opens or expands a window and moves it rightmost.
  Opening a conversation as a page takes it out of the dock, and the dock hides on the conversation
  page. Closing a draft's window discards the draft.
- On small screens there is no dock: every "open" goes to the page.

### The aspect page

A "Conversations" section above Knowledge:

- Up to three of the member's latest conversations tagged with the aspect, as cards: the title, two
  lines of preview, the aspects, a "Needs your answer" badge, the time, and on hover "Open in dock".
- A dashed card filling the rest of the row while there are fewer than three: "Your conversations
  tagged with Strategy appear here." ("Older" once there is one).
- Up to three suggestions the member has not started: dashed cards with a title, the opening
  question, and "Start conversation →". Starting one opens a draft that begins with Strategy Dance
  asking that question, titled after the suggestion.
- "New conversation", already tagged with the aspect, and "All conversations →" once any exists.
- Three columns, two under 720px of container, one under 460px.

The catalogue holds four suggestions per aspect, from `conversations-data.js`'s `SUGGESTIONS`, each
with a title and an opener.

### Rules the design's store follows

- **Title**: the first message's plain text, whitespace collapsed, cut at a word boundary to 48
  characters with "…"; a suggestion's title for a conversation started from one; the first file's
  name for a message with only files, cut the same way (at a word or separator boundary, 48
  characters and "…"), so no title ever nears `MAX_CONVERSATION_TITLE_LENGTH`.
- **Preview** (the list, the cards): "Thinking…" while a run goes; otherwise the last entry that is
  not an aspects note: a note's text; "Question: …", "Skipped: …" or "Answered: a, b"; "Called
  Stripe" or a tool's label, with " · Failed" or " · Cancelled"; a message's plain text without its
  tables, list items joined by commas, prefixed "You: " for the member's; a file's name or "3 files";
  "No messages yet".
- **Relative time**: "Just now", "5 min ago", "2 h ago", "Yesterday", "3 days ago", then "Oct 2".
  `getTimeAgo` and `formatRelativeTime` already do this.
- **Aspects**: Strategy Dance tags a conversation after its first message unless the member set its
  aspects; once the member changes them, they are the member's.

## Architecture

```text
Browser ──reads, live queries, light writes──▶ Data Connect (web connector)
   │
   └──send, answer, stop, resume, retry, upload──▶ Backend (Cloud Run)
                                                     │ queues a task
                                                     ▼
                                             Cloud Tasks `conversation-runs`
                                                     │ OIDC-signed POST
                                                     ▼
                                 Backend `/internal/conversation-runs` (the worker)
                                    ├──▶ Claude Opus 5.5 on Vertex (stream)
                                    ├──▶ tools: knowledge, team, log, top priority, integrations
                                    └──▶ Data Connect (backend connector) ──refresh──▶ Browser
```

- **The browser never calls Claude.** It sends the member's actions to the backend and watches the
  conversation through Data Connect live queries. Every step the worker writes fires their refresh,
  so the thread fills in as the run goes, in every tab and window.
- **Why Cloud Tasks.** The service bills by request, so Cloud Run throttles the CPU once a response
  is sent: a loop left running after answering would stall. A task's request stays open for the
  whole run, so the CPU stays, and the run survives the member closing the tab. Tasks retry when a
  request fails. In development there is no queue: the backend runs the worker in its own process,
  which nothing throttles.
- **Why the backend.** It already verifies callers, holds the Admin SDK and runs on Google Cloud's
  credentials, which is all calling Vertex needs.

### The data

New tables in `schema.gql`, each commented as the existing ones are:

- **`Conversation`**: `id` (made by the client, as a document's is, so a draft has its id before it
  is stored), `user`, `organization` (both references, as `TaskList` has them, so a member removed
  and invited again finds their conversations), `title`, `aspects`, `aspectsSetBy`
  (`ConversationActor`: `MEMBER` or `AGENT`, null until set), `suggestionId` (the catalogue key it
  started from), `activeRunId`, `preview`, `unreadCount` (replies since the member last looked),
  `nextMessagePosition` (see `ConversationMessage`), `messageCount` (the messages it holds, which
  Retry's deletions bring down, as the sequence never does), `isFull` (set by the worker once the
  conversation no longer fits a request, see Attachments), `deletedAt`, `createdAt`, `updatedAt` (its
  last activity). Indexed on `userId`, `organizationId`, `updatedAt`.
  - `activeRunId` is the run in flight, null when idle: a plain UUID rather than a reference,
    because the first send writes the conversation and its run in one mutation, and a reference would
    have it write the conversation's row twice, which Data Connect skips.
  - `preview` (`Any`) is what the list and the cards show of the last entry: its kind, up to 200
    characters of plain text, a tool's name and status, a question's state. A core helper,
    `buildConversationPreview`, builds it, whoever inserts the entry writes it, and the web words it
    in the reader's language. The list then selects no message text.
- **`ConversationMessage`**: what the thread draws. `conversation`, `run` (optional), `kind`
  (`ConversationMessageKind`: `MEMBER_TEXT`, `AGENT_TEXT`, `TOOL_CALL`, `QUESTION`, `ASPECTS`, `NOTE`),
  `text` (Markdown, for the two text kinds), `citations` (`Any`, on agent text, see Drawing a turn),
  the tool call's `toolUseId`, `toolName`, `toolStatus`
  (`RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELLED`), `toolInput` and `toolOutput` (`Any`),
  `toolStartedAt`, `toolDurationMs`, the question's `questionPrompt`, `questionOptions`, `isMultipleChoice`,
  `answerSelected`, `answerOther`, `isAnswerSkipped`, `answeredAt`, the aspects note's `aspects` and
  `aspectsSetBy`, the note's `noteKind` (`STOPPED`, `FAILED`, `REFUSED`, `INTERRUPTED`), `position`,
  `createdAt`. One wide table rather than one per kind, so the thread is one query. Unique on
  `conversation` and `position`.
  - **Ordered by `position`**, not by time: two mutations can share an instant, and only an explicit
    sequence keeps the order things happened in. A mutation that inserts messages claims their
    positions on the conversation's counter first, `conversation_updateMany(where: { id,
    nextMessagePosition: { eq: $position } })` with `@check(this == 1)`, moving it on by as many as it
    inserts in the same write that updates `preview` and `unreadCount`. A writer that loses the race
    (the worker against an aspects note from the browser) reads the counter again and retries. The
    counter only grows, so a retry's deleted messages leave gaps, never reuse.
- **`ConversationRun`**: one go of the agent, from a member's action to its end. `conversation`,
  `trigger` (`MESSAGE`, `ANSWER`, `RESUME`, `RETRY`), `status` (`QUEUED`, `RUNNING`, `WAITING`,
  `COMPLETED`, `STOPPED`, `FAILED`, `REFUSED`, `INTERRUPTED`), `step` (the latest progress line),
  `anchorPosition` (the transcript entry that started it, which Retry goes back to), `context`
  (`Any`: the run's context message, until it is stored), `stopRequestedAt`,
  `leaseExpiresAt`, `attempts`, `pendingToolResults` (`Any`: results held while questions wait),
  `failure` (a reason for the logs, never shown), `createdAt` (set by the server when the run is
  queued), `startedAt` (when a worker claims it, so null while queued and for a run that never
  started), `endedAt`, and `usage` (`Any`: input, cache and output tokens and web searches, per model,
  since a refusal fallback bills another model). Usage is what the credit system will bill from.
  Indexed on `conversationId`, `createdAt`: "the latest run" is the newest by `createdAt`, then `id`,
  never by `startedAt`.
- **`ConversationTranscriptEntry`**: what Claude is sent, kept apart from what the thread draws.
  `conversation`, `run`, `position` (dense from 0, unique per conversation), `role` (`USER`,
  `ASSISTANT`, `SYSTEM`), `content` (`Any`: the exact content blocks, thinking blocks and their
  signatures included), `contextHash` (on a context message, see The transcript), `drawnBlocks` (how
  many of its blocks the thread has drawn, see Drawing survives a crash). Only the backend
  reads or writes it.
- **`ConversationAttachment`**: `id` (made by the client, also the file's name in Storage), `user`,
  `organization`, `conversationId` (a plain UUID rather than a reference, since a draft's files are
  uploaded before the conversation exists), `message` (optional, set when sent), `status`
  (`UPLOADING` while its slot is reserved, `READY` once its file is stored), `name`, `contentType`,
  `size`, `createdAt`. Unsent, the file waits under `pending/`; sent, it lives at
  `organizations/{organizationId}/users/{userId}/conversations/{conversationId}/{attachmentId}`, so
  deleting the organization sweeps it with the rest (see Attachments).

Limits go in strategydance-core beside the others: `MAX_CONVERSATIONS` (1000 per member and
organization), `MAX_CONVERSATION_MESSAGES` (2000 per conversation), `MAX_CONVERSATION_TITLE_LENGTH`
(120), `MAX_CONVERSATION_MESSAGE_LENGTH` (20000), `MAX_CONVERSATION_ATTACHMENTS_PER_MESSAGE` (10),
`MAX_CONVERSATION_ATTACHMENT_SIZE` (10 MiB), `MAX_CONVERSATION_ATTACHMENTS_SIZE` (15 MiB per
conversation, see Attachments), `MAX_PENDING_CONVERSATION_ATTACHMENTS` (30 unsent files per
member), `CONVERSATION_ATTACHMENT_CONTENT_TYPES`, `MAX_QUESTION_OPTIONS` (6),
`MAX_ANSWER_OTHER_LENGTH` (500),
`CONVERSATION_RUN_ROOM` (100), `MAX_ACTIVE_RUNS_PER_MEMBER` (3 per organization),
`MAX_TOOL_CALLS_PER_TURN` (10) and `MAX_TOOL_CALLS_PER_RUN` (50),
`MAX_CONVERSATION_PDF_PAGES` (100 per file) and `MAX_CONVERSATION_PDF_PAGES_TOTAL` (300 per
conversation), `MAX_CONVERSATION_TEXT_ATTACHMENT_LENGTH` (200000 characters per text file),
`CONVERSATION_SUGGESTION_IDS` (M13),
and the release gate `ARE_CONVERSATIONS_STAFF_ONLY`. New error
codes: `ERROR_CODE_CONVERSATION_BUSY` (a run is already going) and `ERROR_CODE_CONVERSATION_FULL`.

### Who writes what

- **The web connector** (`USER`, every operation keyed by `auth.uid` and by the caller's current
  membership, with the predicate `GetTaskLists` uses, and every mutation checking that membership in
  its transaction: conversations outlive a member's removal, so ownership alone would leave a former
  member reading them. Every read also filters the conversation on `deletedAt: { isNull: true }`, as
  `GetOrganizationDocuments` does, the list, the conversation, its history, its run, a tool call and
  both searches alike; only `RestoreConversation` reaches a deleted one. The backend's routes refuse a
  deleted conversation too, and its worker stops at its next write once the conversation is deleted):
  - `GetConversations($organizationId)`, live: the list, the dock and the sidebar badge, with
    `limit: 1000` (`MAX_CONVERSATIONS`) and `orderBy: [{ updatedAt: DESC }, { id: ASC }]`, since a
    query left without a limit stops at 100 and older conversations, and their waiting questions,
    would drop out of the list and the badge. Each
    conversation's fields, `preview` included, and whether a question waits:
    `conversationMessages_on_conversation(where: { kind: { eq: QUESTION }, answeredAt: { isNull:
    true }, run: { status: { eq: WAITING } } }, limit: 1) { id }`, so a question stranded by a failed
    run does not count and the badge needs no counter. It refreshes on run start and finish, on
    message inserts, and on create, delete, restore, aspects and read, with the condition
    `mutation.variables.userId == request.auth.uid && mutation.variables.organizationId ==
    request.variables.organizationId`.
  - Every live conversation query, this one, `GetConversation` and `GetConversationRun`, also
    refreshes on `RemoveOrganizationMember` and `DeleteOrganization`, on their `organizationId`, as
    `GetOrganizationDocuments` does: filtering on current membership only protects the next read, so
    an open subscription must re-run, and come back empty, the moment its reader is removed or the
    organization is deleted.
  - `GetConversation($organizationId, $id)`, live: one conversation and its latest 150 messages,
    more than one run can draw (see Room at the cap), so Retry's deletions always fall inside it,
    newest first, without `toolInput` and `toolOutput`, with their attachments. Only this tail is
    live, so a new entry never sends a long thread again.
  - `GetConversationMessagesBefore($organizationId, $id, $beforePosition)`: the 100 messages before a
    position, read once when the reader scrolls up to them. History does not change, apart from
    retry's deletions, which only ever touch the tail.
  - `GetConversationRun($organizationId, $conversationId)`, live: the latest run (ordered by
    `createdAt`, then `id`), with its status, trigger, step, `createdAt`, `startedAt` and
    `leaseExpiresAt`; the indicator times a queued run from `createdAt`. Progress lines and lease
    renewals refresh this small
    query only, not the thread or the list.
  - `GetConversationToolCall($organizationId, $messageId)`: one call's input and output, read once
    when "View output" opens.
  - `SearchConversations($organizationId, $query)`: Data Connect's full-text search, through an index
    rather than a scan. `Conversation.title` and `ConversationMessage.text` are `@searchable`, with
    the `simple` text search configuration since conversations come in seven languages, and the query
    reads `conversations_search` and `conversationMessages_search` (member and agent text only) with
    `queryFormat: PLAIN`, which requires every word; the web merges the two lists of conversations.
    The message search groups by conversation before its limit: it selects `conversationId` with an
    aggregate, which Data Connect groups by the selected field, so one conversation with many matching
    messages cannot crowd the others out, and each list says its limit (`limit: 1000`), so neither
    stops at the default 100. M3 checks the emulator groups a search that way; if it does not, the
    search moves behind a backend route that pages through the message matches collecting distinct
    conversations.
  - `DeleteConversation` (sets `deletedAt` and asks the active run to stop: two rows, each written
    once), `RestoreConversation`, `MarkConversationRead`, and `UpdateConversationAspects` (the
    aspects as the member's, and the aspects note at a position claimed on the counter, the claim
    refused once `messageCount` is at `MAX_CONVERSATION_MESSAGES`, so a full conversation's aspects no longer change and the
    dialog says it is full; the web
    retrying with the new counter when the worker got there first). A web mutation takes `$userId` so the list's
    refresh condition can match it, and checks `vars.userId == auth.uid`.
  - `RestoreConversation` holds `MAX_CONVERSATIONS` as creating does: both lock the member's
    membership row first and recount, as `RestoreDocument` locks the organization's, so deleting,
    creating and undoing cannot pass the cap.
- **The backend** does everything else, through backend-connector operations that are `NO_ACCESS`
  and take the verified `$userId`: creating a conversation, every message and transcript entry,
  runs and their leases, uploads, and pruning (rows, the conversation's `ConversationAttachment` rows
  by `conversationId`, which no reference cascades to, and its Storage folder), when it creates a
  conversation, the member's
  conversations deleted over a day ago, with their files. Each milestone adds the operations it
  calls: changing an operation's variables later is a breaking connector change, which stops a
  release.
- Every operation that changes what a live query shows is named in its `@refresh`. The agent's
  knowledge writes are added to `GetOrganizationDocuments`' refreshes, and its top priority writes to
  `GetOrganizationTeam`'s.

### A run

```text
member action ─▶ backend route ─▶ run QUEUED, activeRunId set, task queued ─▶ 202
worker: claim (RUNNING, lease) ─▶ loop: request Claude ▸ record the turn ▸ run the tools ─▶ end
end: COMPLETED │ WAITING (questions) │ STOPPED │ FAILED │ REFUSED │ INTERRUPTED, activeRunId cleared
```

- **One run at a time per conversation.** The first send inserts the conversation with
  `activeRunId` already set. A later action locks it with `conversation_updateMany(where: { id,
  userId, activeRunId: { isNull: true } })` and `@check(this == 1)`, then inserts the run; a
  conversation already running answers `ERROR_CODE_CONVERSATION_BUSY`.
- **Leases.** A claimed run's `leaseExpiresAt` is sixty seconds out, renewed every twenty; a claimed
  run past its lease is dead. A queued run is not judged by the clock alone, since a backlog can keep
  a task waiting longer than any fixed deadline: its lease (twenty minutes) only says when to ask
  Cloud Tasks about it again. A route that finds a queued run past that lease looks its named task
  up: while the task exists the run waits on, its lease pushed back; once the task is gone, or was
  never created, the run is dead. Send, answer, stop, resume and retry first finalize a dead active
  run as `INTERRUPTED` (running calls `CANCELLED`, an `INTERRUPTED` note, `activeRunId` cleared). The
  web shows a claimed run past its lease as interrupted, with Resume and Retry, and a queued one as
  still waiting. A page that only watches needs no action from the member for that: when it sees a
  queued run past its lease it calls `POST …/runs/:runId/reconcile`, and again every two minutes
  while it stays so, and that route does the task lookup and finalizes a dead run, so a run whose
  task ran out of attempts or vanished never spins forever.
- **The worker** claims a run with a conditional update (`QUEUED`, or `RUNNING` past its lease) that
  increments `attempts`. It answers 200 only once the run is finished, or was already, and 503 while
  another worker holds a live lease, so Cloud Tasks tries again later; the queue's backoff (90
  seconds) outlasts the lease. The claim, and every fenced write after it, also require the member's
  current membership in the conversation's organization, so removing a member stops their runs at
  the next step: no more of the organization's context goes to Claude, and no tool runs for them.
  Such a run is left to expire, and is finalized as interrupted if they are ever invited back.
- **Fencing.** Every mutation of the worker starts with `conversationRun_updateMany(where: { id,
  status: { eq: RUNNING }, attempts: { eq: $attempt } })` and `@check(this == 1)`, so a worker whose
  run was finalized or claimed again writes nothing more. That fenced write is the run row's only
  write in the mutation, since a later one would be skipped: it carries whatever the mutation changes
  on the run, a lease renewal, a step, or, when the run ends, its terminal status and `endedAt`.
  Usage is checkpointed, not totted up at the end: the mutation that stores an assistant turn writes
  the run's cumulative `usage` through that fenced write, so a worker that takes a run over after a
  crash starts from what was already spent. A request Claude served before the process died, and
  before its turn was stored, would still go unrecorded, so each request is reserved first: the
  fenced write before a request records it as started, with its estimated input tokens (the last
  request's input plus what was appended since), and the write that stores its turn settles it with
  the real usage. A worker that takes over finds an unsettled reservation and charges its estimate,
  with a conservative output allowance, marked as estimated. The credit system then bills every
  request made, and knows which figures are estimates.
- **Queueing.** A task is named after its run, so creating one is idempotent: `ALREADY_EXISTS` counts
  as success, and an error that leaves it unclear whether the task exists (a timeout, `UNAVAILABLE`)
  is retried with the same name. Even a definite refusal leaves the run `QUEUED`, so the send stays
  idempotent: the route answers 503, and the browser's retry with the same `messageId` finds the
  queued run and creates the same named task again. A run whose task never comes to exist, because
  the retry never came, is found by the reconcile route once its lease passes (see Leases) and
  finalized as interrupted, with Retry.
- **Recovery and side effects.** A call's message is written `RUNNING`, with `toolStartedAt`, before
  the call is made. A worker that claims a run after a crash finds calls that started and have no
  result. The built-in tools that are safe to repeat run again: reads, a create keyed by its
  `tool_use` id, an update guarded by its revision. `set_top_priority` is not one of them, since the
  member may have set a newer priority since, which a replay would overwrite, and neither is an
  integration call, since it may have happened: each is marked failed, and its result tells the
  model it was interrupted and may have run, so the model checks or asks.
- **Limits.** At most 25 requests to Claude and 10 minutes per run (the task's dispatch deadline and
  the Cloud Run timeout are 15 minutes); at most 60 seconds per tool call. A run that hits one fails
  with a note.
- **Room at the cap.** A run draws at most `CONVERSATION_RUN_ROOM` (100) entries, its note included:
  before storing a turn, the worker checks the turn's entries fit what the run has left, keeping one
  for the note, and otherwise stops the run there with a note saying the response grew too long. The
  send route refuses a message with `ERROR_CODE_CONVERSATION_FULL` once a conversation's
  `messageCount` reaches `MAX_CONVERSATION_MESSAGES` minus `CONVERSATION_RUN_ROOM`, so a run always
  has room for everything it may draw, and the live tail (150) always holds a whole run. The cap
  counts the messages a conversation holds, never the sequence: every insert raises `messageCount`
  in the write that claims its position, and Retry lowers it by the messages it deletes, in the same
  mutation, so retrying never fills a conversation.
- **The cap holds on every claim**, in the claim's own condition, since a run can also start from an
  answer or Resume, and an aspects note can land mid-run. An entry a run draws claims only while
  `messageCount` plus its entries stays below `MAX_CONVERSATION_MESSAGES`, keeping the last position
  for a note; a run's closing note may take that last position; an aspects note claims only while
  at least `CONVERSATION_RUN_ROOM` positions stay free. Every run start, the send, the answer's
  continuation, Resume and Retry alike, requires that much room, so a run that starts always has
  its hundred, and a conversation without it shows full.
- **Concurrency.** These are not usage limits, which wait for credits, but bounds on how much runs
  at once: at most three runs in flight per member in each organization
  (`MAX_ACTIVE_RUNS_PER_MEMBER`, refused with `ERROR_CODE_CONVERSATION_BUSY`), and the queue
  dispatches at most 50 tasks at a time, which also bounds a member of several organizations. Every
  mutation that starts a run first locks the member's membership row in that organization, the one
  creating and restoring lock, then counts their active runs there and inserts, so two sends from
  two conversations at once cannot both find room.
- **The loop.** A manual loop rather than the SDK's tool runner, because a run stops for answers and
  carries on in another request, and every step is written as it happens. Each turn: read the stop
  flag; build the request from the transcript and check it (see The transcript); stream it, writing
  each progress line to `run.step` at most once a second and checking the stop flag every two
  seconds; store the finished assistant turn; draw it as messages; then by `stop_reason`:
  - `end_turn`: done, `COMPLETED`.
  - `tool_use`: run the turn's tools in transcript order: a run of consecutive read-only built-in
    calls (`search_knowledge`, `read_knowledge`, `get_team`, `read_log`) goes four at a time, and every
    write (`create_knowledge`, `update_knowledge`, `set_top_priority`) and every integration call,
    whose annotations prove nothing, goes alone, in order, so two writes never land in the wrong
    order. Record each result on its message, store one
    user entry holding every `tool_result` in order, and go round again. A turn runs at most ten
    calls and a run at most fifty (`MAX_TOOL_CALLS_PER_TURN`, `MAX_TOOL_CALLS_PER_RUN`): a call past
    either is not run, and its result tells the model so, so one turn cannot fan out into thousands
    of requests across the dispatched runs. A turn with `ask_user` runs its other tools, keeps their
    results in `pendingToolResults`, and ends the run `WAITING`.
  - `pause_turn` (web search's server-side loop paused): send the turn back as it is, up to five
    times, keeping the pieces in memory.
  - `max_tokens`: run nothing, fail with a note.
  - `refusal`: see The agent.
- **Drawing a turn.** Thinking blocks are never drawn. Consecutive text blocks become one
  `AGENT_TEXT`, and the citations web search attaches to them are kept: each cited span is stored
  with its sources in the message's `citations` (`Any`: the span's offsets in `text`, and each
  source's address, title and quoted text), and the thread draws a small numbered link after the span
  and the sources under the message. A `tool_use` becomes a `TOOL_CALL` (`RUNNING`), or a `QUESTION` for `ask_user`. A web
  search (`server_tool_use` with its `web_search_tool_result`) becomes a finished `TOOL_CALL` whose
  output lists the results' titles and addresses. Each `AGENT_TEXT` and `QUESTION` adds one to
  `unreadCount` and replaces `preview`, in the write that claims its position.
- **Drawing survives a crash.** A turn is stored in the transcript first, then drawn block by block,
  so a crash can fall between the two. Each drawn message's id derives from its transcript entry and
  block index, so drawing it twice is a conflict rather than a duplicate, and the entry keeps a
  cursor, `drawnBlocks`, advanced in the same mutation as each message it draws. A worker that claims
  a run after a crash first draws the rest of the last entry, from its cursor. It then deals with the
  entry's tool calls: a call whose message exists but which never started is handled as Recovery and
  side effects says, and a call that had no message yet gets one and runs like any other.
- **Ending.** One mutation: the fenced write gives the run its status, `endedAt` and usage, and the
  conversation's `activeRunId` is cleared, only where it still names this run.

### The transcript

Claude Opus 5.5's thinking blocks are bound to the conversation that produced them: the system
prompt, the tools and every earlier message have to come back byte for byte. On accounts created
after 2026-08-31, which this project probably is, the API refuses a request that edited them, and
the plan treats it as enforced either way. So the transcript is stored as sent, blocks and signatures
untouched, and replayed as stored; the thread's messages are a separate drawing of it. It is
append-only with one exception: Retry cuts the tail back to a run's anchor, which leaves a prefix
the remaining thinking blocks were made with. Nothing else ever edits or deletes an entry. The system
prompt is the same text for every conversation and the tools the same list. Files go in as base64
of the stored bytes, which never change: the transcript holds a placeholder naming the file, and
the worker swaps the bytes in.

**The rules**, which a pure `checkTranscript` function enforces before every request, with tests:

1. Entry 0 is `USER`.
2. A `SYSTEM` entry sits directly after a `USER` entry and directly before an `ASSISTANT` entry: never
   last, never beside another `SYSTEM` entry. (These are Claude's rules for mid-conversation system
   messages, which Opus 5.5 takes on Vertex.)
3. An `ASSISTANT` entry with client `tool_use` blocks is followed by a `USER` entry that opens with one
   `tool_result` per id, in order, before any text, image or document block.
4. Only the last entry may hold unanswered `tool_use` blocks.

The rules hold for what is stored. A request may end with one more `SYSTEM` entry, the run's context
message before it is stored, directly after a `USER` entry, which Claude accepts as a last message.
`checkTranscript` checks the request as it is sent, that trailing message included.

**How each flow keeps them:**

- **A run's context message** is built when the run starts and kept on the run. Every request of the
  run sends it last until the run's first assistant turn lands; it is then stored with that turn, as
  `SYSTEM` then `ASSISTANT` at consecutive positions, in one mutation. A turn that never lands (a stop
  mid-stream, a refusal, an API error, `max_tokens`) stores neither, so the transcript still ends on
  its `USER` entry.
- **`pause_turn` pieces** stay in memory, and are stored as consecutive `ASSISTANT` entries once the
  turn ends on another stop reason; a stop in between drops them.
- **Send**: the new `USER` entry carries a result for every unanswered `tool_use` of the last turn
  first, each built from its question's stored state: a question already answered sends its answer,
  one still waiting sends "The member skipped this question." and is marked skipped; then the
  results in `pendingToolResults`, and "The member stopped the response before this ran." for a call
  a stop cancelled; then the member's text and files.
- **Answer** (`POST …/answers`): records the answer on its question. Once every question of the
  waiting run has one, a `USER` entry with all the waiting turn's results (the answers as JSON, and
  `pendingToolResults`) is stored and a run starts. Answers are serialized on the conversation: each
  one's mutation first locks the conversation's row, refuses if the run is no longer `WAITING`, then
  records the answer on its question's row and counts what is left, so two answers sent at once
  cannot both see the other missing. The request that sees none left starts the next run in a second
  mutation. An approval (M19) is answered the same way.
- **The continuation survives a crash between the two.** Starting it is idempotent (see Consuming a
  waiting turn) and reachable from three places: the answer route right after the answer, the same
  answer sent again (it finds the answer recorded, counts none left and starts it), and the reconcile
  route, which the page also calls when it sees a waiting run whose questions are all answered. A
  backend that stops between the two mutations leaves a state the next of those finishes.
- **Consuming a waiting turn.** A send and the last answer can race for the same waiting turn, so
  every mutation that starts a run on one (the answer's continuation, or a send) moves the waiting
  run out of `WAITING` under `@check(this == 1)`, as its only write to that run, together with taking
  the conversation's `activeRunId`. Whichever commits first starts the run and builds the results
  from the questions' states at that moment; the other finds the turn consumed: a send gets
  `ERROR_CODE_CONVERSATION_BUSY` and is retried by the browser, an answer's continuation does nothing,
  its answer already sent with the winner's results. A script under `scripts/` races an answer
  against a send in the emulators.
- **Stop** (`POST …/stop`) sets `stopRequestedAt`. The worker aborts the stream (the turn being
  written is dropped), or lets the calls already running finish and records them, so nothing is left
  in doubt, and cancels the ones not started: they become `CANCELLED`, a `STOPPED` note is added, the
  run ends `STOPPED`. A dead run is finalized by the route itself.
- **Resume** (`POST …/resume`), offered when the last entry is a stopped or interrupted note: the
  note goes and a run starts. When the transcript's last entry holds unanswered `tool_use` blocks,
  the run executes the calls that never started and the built-in ones that did (their messages go
  back to `RUNNING`), answers an integration call that had started as interrupted (see A run),
  stores the results, then sends its context and the request; when the last entry is `USER` (the
  stream was cut), it sends its context and the request straight away.
- **Retry** (`POST …/retry`), offered with a stopped, interrupted, failed or refused note: every run
  records its anchor, `anchorPosition`, the transcript position of the `USER` entry that started it
  (the member's message, files only included, the answers, or the resumed calls' results). Retry
  cuts the transcript after the last run's anchor (its context message goes too), deletes the
  messages that run drew, and starts a run on the same anchor with a fresh context message. Cutting
  the tail leaves a prefix the thinking blocks were made with. What the cut part wrote to knowledge
  or the top priority stays written. Aspects notes written during the run can push its first
  entries out of the live tail into a loaded history page, so the route answers with the id of the
  run it removed, and the page drops that run's messages from every page it holds, and refetches
  its history pages when it cannot tell.
- **The context message's profile part** (the member, the organization, the conversation's aspects)
  is included when its hash differs from the `contextHash` of the last context message still in the
  transcript, so a retry that cut one sends it again.
- Every request sends `thinking.block_binding.prefix_mismatch_behavior: "drop_block"` (beta
  `thinking-binding-controls-2026-08-01`) and logs any `input_transformations`. A release that
  changes the system prompt or the tools makes existing conversations lose their earlier reasoning
  once, rather than fail.

### Attachments

- The browser shrinks an image to at most 1568px on its long side before sending it. A file goes up
  through the backend (`PUT …/attachments/:attachmentId`), which checks membership, the type (sniffed
  from the bytes) and size, and the member's quota of unsent files (30), and streams it into Storage
  rather than holding it in memory. The quota counts only unsent rows younger than two days, and the
  route first deletes the member's unsent rows older than that, whose files the lifecycle rule below
  has removed, so abandoned uploads never use up the quota for good. The count and the row's insert
  share one mutation that first locks the member's membership row, so uploads sent at once at the
  cap cannot all pass; an object whose row is refused ages out under the lifecycle rule.
- **The quota is reserved before any byte is accepted.** The route first inserts the row, with the
  client's id, as `UPLOADING`, in the mutation that locks the member's membership row and counts
  their unsent rows, so a member at the cap is refused before anything reaches Storage, and two
  requests with one id end with one row. Then the object, then the row turned `READY` with the size
  and type confirmed. A reservation still `UPLOADING` after ten minutes is pruned with the expired
  unsent rows, its object first: the pending object at its path is deleted, and only then the row,
  which stays, still counted, when the delete fails, to be tried again on the next prune. So a failed
  upload holds its slot only that long, and Storage never holds more than the quota's worth of a
  member's unsent files.
- **Uploads are create-only**, since every replay depends on the bytes never changing: the object is
  written with a generation-match-zero precondition, Storage finalizes an upload atomically so a
  failed stream leaves no object, and a second `PUT` with the same id cannot replace one. A retry
  with the same id finds its row: `READY`, it answers as the first did; `UPLOADING`, it turns it
  `READY` when the object is there with the same size and type, and writes the object otherwise. The
  row's name, type and size never change once `READY`; its other update is its association with the
  message that sends it, `message` going from null to set once, guarded on it being null.
- **Claude's limits are checked here, not in the browser**, whose shrinking is a convenience: an
  image over 5 MB or 8000 pixels on a side (read from its header), or in a format Claude does not
  take, is refused, since a stored file Claude refuses would fail every later request of its
  conversation. So is a PDF over 100 pages, counted from its page tree, and sending refuses files
  that would take a conversation's PDFs past 300 pages in all, since every replay carries them all.
  Claude takes up to 600 pages a request on a 1M-token model such as Opus 5.5 (100 on 200k-token
  ones), which leaves a margin.
- An upload lands under `pending/{organizationId}/{userId}/{attachmentId}`, outside `organizations/`,
  where a bucket lifecycle rule deletes what is two days old: a draft never sent costs nothing for
  long, whether or not its author comes back. Sending copies each file into the conversation's
  folder, `organizations/{organizationId}/users/{userId}/conversations/{conversationId}/`, checking
  the conversation's budget.
- **Reading a file goes through the backend too**: `GET …/attachments/:attachmentId` checks that the
  caller is still a member and owns the conversation, and streams the bytes with private cache
  headers; the thread fetches it with the caller's tokens and shows it as an object URL. A Storage
  rule could check only the uid, which stays true after a member is removed, so `storage.rules` keeps
  granting clients nothing under `organizations/`, as it does today.
- Claude receives images as `image` blocks, PDFs as `document` blocks and text files as text
  `document` blocks, all base64. Vertex has no Files API, and a request takes about 32 MB, every
  earlier file included. So a conversation's files are capped at 15 MiB, about 20 MB once encoded,
  leaving room for the text; and before each request the worker measures the serialized body. Past
  30 MB, or once a request has read more than 800000 input tokens, the worker marks the conversation
  full: the send route refuses new messages with `ERROR_CODE_CONVERSATION_FULL`, and the thread says
  to start a new one. Files are checked before that can happen, since one large file could pass the
  model's context on the very first request: a text file is held to 200000 characters
  (`MAX_CONVERSATION_TEXT_ATTACHMENT_LENGTH`), and a message carrying files is sent only after the
  send route counts the next request's tokens with the token-counting endpoint, which Vertex offers,
  and refuses it past 700000. The service gets both `--memory 2Gi` and a low `--concurrency` (20 to start,
  measured on the heaviest conversation), since a request can hold its files several times over
  (bytes, base64, the SDK's copy) and Cloud Run's default of 80 would put too many on one instance.

### The agent

- **The client**: `AnthropicVertex` with `projectId: 'strategydance'` and `region: 'global'`, behind
  a small interface so tests, and development when wanted, can swap in a scripted client. Load the
  `claude-api` skill before writing this code: the request shape below names features, and the
  skill and the SDK give their exact spelling.
- **The request**, streamed: model `claude-opus-5-5`; `max_tokens` 64000 (thinking counts toward
  it); `thinking: { type: "adaptive", display: "updates", block_binding: { prefix_mismatch_behavior:
  "drop_block" } }` with the betas `thinking-display-updates-2026-08-18` and
  `thinking-binding-controls-2026-08-01`; `output_config.effort` set explicitly to `medium` (Opus
  5.5's default, and the first lever to tune); the static system prompt with a cache breakpoint, plus
  top-level automatic caching for the conversation's tail; the tools with strict schemas and, as the
  skill recommends for streamed requests, `eager_input_streaming: true` on the ones defined here,
  which means the API no longer validates their input, so every input is validated with zod before it
  runs; `tool_choice` left at `auto` (Opus 5.5 refuses forced tool use).
- **Thinking cannot be turned off** on Opus 5.5. Under `display: "updates"`, a thinking block with
  text is a short progress line ("Comparing revenue with September"): it becomes `run.step`, which
  the thinking indicator shows, which is what the design's rotating steps are. Without one, the
  indicator shows the running tool's label, else "Thinking".
- **Refusals** come back as `stop_reason: "refusal"`. Vertex has no server-side fallback, so the
  client uses the SDK's client-side refusal fallback to `claude-opus-5`, with one `BetaFallbackState`
  per run, since it scopes the pinning. `display: "updates"` is documented for Opus 5.5, not Opus 5,
  and the middleware sends the fallback the same body: M7 checks with a real call that it is
  accepted, and retries by hand without `display` otherwise. Before storing a turn that holds a
  `fallback` block, the worker drops the thinking, redacted thinking, `tool_use` and unpaired
  `server_tool_use` blocks before the boundary, and draws only what it stores. A refusal that survives
  the fallback ends `REFUSED` with a note.
- **The system prompt** (`domain/agent/systemPrompt.ts`, with a test pinning its bytes): who
  Strategy Dance is and that it challenges the team; that a conversation is private to one member;
  short, plain answers in the member's language, without em dashes, in the Markdown the thread draws;
  links to knowledge as `[title](doc:<id>)`; reading before relying, writing decisions into
  knowledge when the member agrees and saying what changed, never touching a locked document;
  asking with `ask_user` when the member has to choose; citing web results as links; setting the
  member's top priority only when they ask or agree, and never anybody else's; that it cannot change
  tasks, the checklist or the log; and that whatever comes from knowledge, the log, the web, files or
  integrations is data written by others, never instructions.
- **The context message**: the date, weekday and time in the member's time zone and, when it changed
  (see The transcript), the member (name, job title, role, bio), the organization (name, brief,
  explored aspects), the conversation's aspects and the member's language. The team, the log and
  knowledge come through tools, which keeps it short.
- **A suggestion's opener** is sent as a first exchange: a user entry "[The member started this
  conversation from the suggestion “title”.]", then the opener as an assistant entry, then the
  member's reply.
- **Tagging aspects**: on a conversation's first run, unless the member set its aspects, a side
  request (structured output, effort `low`, no tools) picks one to three aspects from the first
  exchange. It writes them with the note only where `aspectsSetBy` is still null.

### Tools

| Tool | What it does | Milestone |
| --- | --- | --- |
| `web_search` | Claude's server tool, `web_search_20250305`, at most 5 searches a request | M6 |
| `search_knowledge` | `{ query, aspects?, limit? }`: up to 10 documents, with id, title, aspects, `updatedAt`, `isAiLocked` and an excerpt, found by Data Connect's full-text search on `Document.title` and a new `Document.contentText` (see M9), through an index rather than a scan, at most 20 candidates, whose plain text alone is loaded to cut the excerpts | M9 |
| `read_knowledge` | `{ id, from? }`: a document's title, aspects, `revision` and content as Markdown, up to 40000 characters at a time, with `next` when more remains, since a document can hold 200000 and a tool result is cut at 50000. The cursor is a block and an offset within it, so a page ends at a block's end when it can and inside a block only when one block alone passes the budget, as a single 200000-character paragraph would | M9 |
| `create_knowledge` | `{ title, aspects, content }`: a new document, content in Markdown. Its id derives from the `tool_use` id, so a run retried after a crash finds the one it made rather than making two | M9 |
| `update_knowledge` | `{ id, revision, title?, aspects?, content?, append?, replaceBlocks?, replaceText? }`: `content` replaces a document small enough to read whole, `append` adds to the end, `replaceBlocks: { from, to, content }` replaces a range of blocks, and `replaceText: { find, replace }` replaces one exact occurrence of a piece of text, refused unless it occurs exactly once, so a large document, or one oversized block, is edited without being rewritten. Refused when the AI lock is on ("The team locked this document against AI changes. Tell the member instead.") or the revision moved ("The document changed since you read it. Read it again first.") | M9 |
| `get_team` | Every member: id, name, job title, role, bio, top priority as text and when it was set | M11 |
| `read_log` | `{ from, to, memberId?, cursor? }`, at most 31 days: entries as text, with author and date, newest first, up to 40000 characters, with a `cursor` when more remain. The backend reads 50 entries at a time, ordered by date then id, and stops reading once the budget is spent, so a busy month never loads in full | M11 |
| `set_top_priority` | `{ text }`: replaces the member's own top priority, Markdown stored as rich text, within the Today page's two limits: `MAX_TOP_PRIORITY_TEXT_LENGTH` (500) characters of text and `MAX_TOP_PRIORITY_LENGTH` serialized. Records the day's activity, as every change to Today data does | M11 |
| `ask_user` | `{ prompt, options (2 to 6), multiple }`: ends the run until the member answers | M12 |
| `list_integrations` | The organization's servers, whether each works for this member, and their tools' names and descriptions | M19 |
| `describe_integration_tool` | `{ integration, tool }`: the tool's input schema | M19 |
| `call_integration_tool` | `{ integration, tool, arguments }`: calls it as this member, after their approval unless an administrator allowed the tool to run without it | M19 |

- Each tool's description says when to call it, which is what Opus reads to decide.
- A result goes back as JSON, cut to 50000 characters with a note saying so. A failure goes back
  as `is_error: true` with a sentence the model can act on.
- The thread labels each tool from the `conversation` catalogue, running and done: "Searching
  knowledge" and "Searched knowledge", "Opening knowledge" and "Opened knowledge", "Creating
  knowledge", "Updating knowledge", "Reading your team", "Reading the log", "Setting your top
  priority", "Searching the web".
- Integrations go through three fixed tools rather than one tool per server tool, so the tools list
  never changes with what an organization connects, which keeps the transcript valid and the cache
  warm.
- Each milestone that adds tools changes the tools list for existing conversations: `drop_block`
  makes that a one-time loss of their earlier reasoning, nothing more.

### Rich text and Markdown

Documents, top priorities and log entries are stored as BlockNote blocks: paragraphs, headings 1 to
3, quotes, bulleted, numbered and check list items, bold, italic, underline, strikethrough, and
links to web and mail addresses. The agent reads and writes Markdown. M8 moves the stored model
(`richText.ts`'s types, `normalizeRichText`, `parseRichText`, `getRichTextText`) from the design
system into strategydance-core, which the backend can import, and adds `richTextToMarkdown` and
`markdownToRichText` there, dependency-free, for exactly that subset: anything else (code, tables,
images) becomes paragraphs, and links keep only web and mail addresses. The thread draws the
agent's Markdown with a new design-system `Markdown` component (M2: `react-markdown` and
`remark-gfm`, no raw HTML, an allowlist of elements, a `renderLink` prop the web uses for `doc:`
links).

### Release gate

Until M20, conversations exist for Strategy Dance administrators only. The gate hides an unfinished
feature; it protects no data, since a conversation is its owner's own. A staff member who loses the
role keeps reading the conversations they wrote, which exposes nothing of anybody else's, while the
backend's routes, checked on every action, stop them starting or continuing runs, and the
worker's claim checks the role again, so a queued run stops too:

- The sidebar item, the aspect page section and the dock show for `user.isAdministrator` only. The
  sidebar's `useConversations` runs for staff only and never behind a waiter.
- The routes sit behind a release bouncer that redirects anybody else to `/today`, as
  `AdministrationBouncer` does.
- The backend's conversation routes run `staffOnlyMiddleware`, and so do the integration routes of
  M17 and M18, the OAuth initiation included: an authorization's state only exists once a staff
  member started it, so the callback is gated through it. The integration list query filters on the
  caller being staff until M20.
- The web connector's conversation operations need no gate of their own: a conversation only comes
  into being through the backend's gated routes, so a caller who skips the interface reads and
  changes nothing.
- All of it keys off `ARE_CONVERSATIONS_STAFF_ONLY` in strategydance-core, which M20 removes.
  Locally, `bun run grant:administrator <email>` makes an account staff.

### Google Cloud setup

Done once by a human, before M5 and M6 reach production (development uses the developer's ADC and
in-process runs):

1. Enable Claude Opus 5.5, and Claude Opus 5 for the refusal fallback, for project `strategydance`
   in Agent Platform's Model Garden (accept Anthropic's terms), and check the quota for
   `claude-opus-5-5` on `global`. Raise it before M20.
2. `gcloud services enable aiplatform.googleapis.com cloudtasks.googleapis.com --project strategydance`.
   Before M6, allow web search for partner models in the organization policy
   (`constraints/vertexai.allowedPartnerModelFeatures`, which leaves `web-search` off by default), an
   organization administrator's change, or every request carrying the tool fails.
3. Grant the runtime service account (the Compute Engine default one, see `CLAUDE.md`)
   `roles/aiplatform.user`, `roles/cloudtasks.enqueuer`, `roles/cloudtasks.viewer` (the queued-run
   check reads tasks, which the enqueuer role does not allow), and `roles/iam.serviceAccountUser` on
   itself, since it signs its tasks' OIDC tokens. If dispatches fail on the token, also grant the
   Cloud Tasks service agent `roles/iam.serviceAccountTokenCreator` on it.
4. `gcloud tasks queues create conversation-runs --location us-central1 --max-attempts 5
   --min-backoff 90s --max-concurrent-dispatches 50 --project strategydance`.
5. Developers: `gcloud auth application-default login` as an account with `roles/aiplatform.user`, so
   `bun run dev:backend` reaches Vertex. Development calls the real model and costs money.
6. For M15: the bucket's lifecycle rule deleting objects under `pending/` older than two days
   (`gcloud storage buckets update gs://strategydance.firebasestorage.app --lifecycle-file=…`).
7. Before M20: a budget alert on Vertex spend, since nothing caps usage yet.
8. For M17 to M19: a Cloud KMS key for integration secrets, with
   `roles/cloudkms.cryptoKeyEncrypterDecrypter` for the runtime service account.

### Cost

At first-party list prices ($4 per million input tokens, $20 per million output, cache reads $0.20,
cache writes $5; check Vertex's partner prices) and medium effort, a run of three requests over a
cached 15000-token conversation, writing 2000 tokens each, costs about $0.15, plus about $0.01 per
web search. A member running ten a day costs about $1.50 a day, two orders of magnitude more than
the rest of the bill per user (`operations-costs.md`). Usage is recorded per run from M6, and M20
adds a section on it to `operations-costs.md`.

## Conventions for every milestone

- Follow `CLAUDE.md`: a branch from `origin/dev`, granular commits each green on lint, typecheck,
  test and build, a pull request into `dev`, the Copilot loop, then a human merges.
- Read this document's Architecture first. Load the `claude-api` skill before writing any Claude
  SDK code, and never guess an SDK name.
- Strings go in the `conversation` catalogue (`integration` for the MCP pages), registered app-wide
  in `_app.tsx`'s `APP_MESSAGE_TYPES` since the dock and the sidebar need it everywhere, and
  `bun run translate` runs whenever one changes. No em dash in a message.
- Web files: `components/conversation/`, `hooks/conversation/`, `utils/conversation/`,
  `contexts/ConversationDockContext.ts`. One concern per file, a waiter above the bouncer that reads
  its data, waiters keyed on the organization's id, no `useMemo` or `useCallback`.
- Backend files: `routes/conversations.ts` (mounted at `/organizations/:organizationId/conversations`
  with `mergeParams`), `routes/internal.ts`, `middleware/organizationMember.ts`,
  `middleware/staffOnly.ts`, `middleware/cloudTasks.ts`, `domain/conversations/`, `domain/agent/`.
- Data Connect: a mutation writes each row once; messages are ordered by `position`, claimed on the
  conversation's counter; live queries name every mutation that changes them; backend operations
  take `$userId` and check it against the rows; each milestone adds the operations it calls.
- CI runs without emulators. Domain tests mock `strategydance-database/backend` with `mock.module`, as
  `deleteOrganization.test.ts` does; the SQL conditions are checked by hand against the emulators,
  with a script under `scripts/`, never a `*.test.ts`.
- A milestone that sets a convention later sessions must follow adds it to `CLAUDE.md` in the same
  pull request.
- Every milestone ends with the four checks green, and the UI ones with the change looked at in a
  browser, on desktop and phone widths, against the design.

## Milestones

| # | Milestone | Packages | PR |
| --- | --- | --- | --- |
| M1 | The conversation tables and the web's operations | database, core | |
| M2 | The Markdown component | design-system | |
| M3 | Navigation, the list, search and delete, from seeded data | web, backend, root | |
| M4 | The conversation page and its thread, read-only | web | |
| M5 | Sending, and the run pipeline without a model | backend, database, web, root | |
| M6 | Claude replies, with web search | backend, database, web | |
| M7 | Stop, resume, retry, failures and refusals | backend, database, web | |
| M8 | Rich text and Markdown in core | core, design-system, web | |
| M9 | Knowledge tools and knowledge links | backend, database, web | |
| M10 | Mentioning knowledge in the composer | web | |
| M11 | Team, log and top priority tools | backend, database | |
| M12 | Questions | backend, database, web | |
| M13 | Aspect tagging, suggestions and the aspect page section | backend, database, core, web | |
| M14 | The dock | web | |
| M15 | Attachments: storing them and sending them to Claude | backend, database, root | |
| M16 | Attachments in the composer and the thread | web | |
| M17 | Integrations: the organization's servers | database, backend, web | |
| M18 | Integrations: members connect their accounts | database, backend, web | |
| M19 | Integrations in conversations | database, backend, web | |
| M20 | Launch | all | |

### M1: The conversation tables and the web's operations

The data model and the web connector's operations, with nothing yet using them.

- The five tables and their enums, as The data describes, commented in `schema.gql`'s style, with
  `@searchable(language: "simple")` on `Conversation.title` and `ConversationMessage.text` (check
  that the emulator takes `simple`, and fall back to `english` otherwise). All additive, so the
  release migrates by itself.
- The web connector's operations, as Who writes what lists them. No backend operation yet: each
  milestone adds the ones it calls.
- The limits, error codes and gate in strategydance-core, and `buildConversationPreview` there,
  with tests.
- In `CLAUDE.md` § The database: the transcript is backend-only and append-only, with one exception
  (Retry cuts the tail back to a run's anchor; nothing else ever edits or deletes an entry), the thread is a
  drawing of it, and messages are ordered by a `position` claimed on the conversation's counter.
- Verify: `bun run generate:database` writes both SDKs; the four checks pass; in the emulators, a
  script under `scripts/` runs each operation once.

### M2: The Markdown component

- `Markdown` in the design system: `react-markdown` and `remark-gfm`, no raw HTML, an allowlist
  (paragraphs, lists, tables through the design system's `Table`, bold, italic, strikethrough,
  links, line breaks), headings drawn as bold paragraphs, a `urlTransform` letting through `http`,
  `https`, `mailto` and `doc:` only, a `renderLink` prop, and a `size` prop for the dock's 14px and
  the page's 16px (`.cv-rt` in the design).
- A story with the design's replies from `conversations-data.js`: lists, a table, links, bold.
- Verify: Storybook, at both sizes; the four checks.

### M3: Navigation, the list, search and delete, from seeded data

- `bun run seed:conversations <email>` (root and backend scripts, emulators only, refusing otherwise
  as `grantAdministrator.ts` does), writing ad hoc GraphQL through `executeGraphql` so no seed
  operation is ever deployed: the design's seven conversations, every kind of entry, with positions,
  counters and `createdAt` set explicitly and each `preview` built by `buildConversationPreview`.
- The `conversation` message type (its module and its `MESSAGE_TYPES` entry), registered in
  `_app.tsx`'s `APP_MESSAGE_TYPES`.
- Sidebar: the "Reflection" group with Conversations and Knowledge, Conversations staff only, its
  badge (a `badge` prop on `NavigationLink`, drawn with `SidebarMenuBadge`, with an accessible label).
- `_app/conversations.index.tsx` behind the release bouncer, its waiter keyed on the organization's
  id, `useConversations` copying `useOrganizationTeam`'s live pattern (`retryOnMount: false`,
  `hasFailed`).
- The list: header (New conversation arrives in M5), search (debounced, through
  `SearchConversations`), table, previews worded from `preview`, empty states, Delete with confirm
  and Undo through `DeleteConversation` and `RestoreConversation`.
- Utilities with tests: wording a preview, merging the two search results.
- Verify: seed, then the list at desktop and phone widths against the design; search; delete and
  undo; a non-staff account sees no item and is redirected.

### M4: The conversation page and its thread, read-only

- `_app/conversations.$conversationId.tsx`: search param `isNew` validated (`aspect` in M13), and
  `beforeLoad` refusing an id that is not one, as `knowledge.$documentId.tsx` does; a
  `ConversationOrganizationBouncer` copied from `KnowledgeOrganizationBouncer`, back to the list when
  the organization changes; waiters keyed on the organization's id; `useConversation` and
  `useConversationRun`.
- The page: the bar, the title, the aspects button (on saved conversations: a draft's aspects arrive
  in M13, sent with its first message); `KnowledgeDocumentAspectsDialog` generalized into an
  `AspectsDialog` taking its labels as props; `UpdateConversationAspects`.
- The thread drawing every kind of entry, read-only: text through `Markdown`, tool calls and their
  output dialog (`GetConversationToolCall`), questions in their answered and skipped states (waiting
  ones drawn disabled until M12), notes, aspects notes, the thinking indicator from the run with its
  own one-second timer (`useNow` ticks once a minute), and the missing conversation's state.
- The live tail and the older pages (`GetConversationMessagesBefore`) loaded as the reader scrolls
  up, merged into one thread.
- `MarkConversationRead` when the page shows a conversation with unread replies.
- Verify: the seeded conversations against the design at both widths; switching organization on a
  conversation's page goes back to the list.

### M5: Sending, and the run pipeline without a model

The member can send, and a placeholder agent answers through the real pipeline. The largest
milestone: its web part (the composer and drafts) can be its own pull request if the review gets
heavy.

- Dependencies: `@google-cloud/tasks` (the same google-gax stack `@google-cloud/secret-manager`
  already runs under Bun) and `google-auth-library`, declared directly since Bun's isolated install
  does not expose firebase-admin's copy.
- The conversations router; `organizationMember`, `staffOnly` and `cloudTasks` middlewares, the last
  verifying the OIDC token's audience (`PRODUCTION_API_URL` + `/internal/conversation-runs`) and its
  service account, both backend constants, since Cloud Run tells the service neither.
- `POST …/messages`, body `{ messageId, text }` for now (later milestones add a draft's aspects,
  suggestion and attachments): the first message creates the conversation (title rule,
  `MAX_CONVERSATIONS` under the membership lock, pruning what the member deleted over a day ago) with
  its message, its queued run and its first transcript entry, in one mutation; a later one locks the
  conversation and refuses one without room for a run; both hold the member to
  `MAX_ACTIVE_RUNS_PER_MEMBER` and finalize a dead run; then the task is queued and the route answers
  202 with the run's id. `messageId` is made by the client, and the route is idempotent on it: a retry after a lost
  answer or a partial failure completes what is missing and answers with the same run, never
  sending twice.
- `enqueueRun`: a named task (`run-<runId>`, so a repeat does not queue twice), an OIDC token, a
  15-minute dispatch deadline; in development, `runConversation` in-process without waiting.
- `POST /internal/conversation-runs` and `runConversation`: claiming, leases, fencing, the 200 and
  503 answers, finishing, drawing with its cursor and deterministic ids, and a placeholder agent that
  writes one `AGENT_TEXT` through the code paths M6 uses. `POST …/runs/:runId/reconcile`, which the
  page calls for a queued run past its lease. The backend operations for all of it.
- `deploy:backend` gains `--timeout 900`. The welcome email's lease goes from ten minutes to twenty
  (`ClaimWelcomeEmail` and its comment in the backend connector, the `schema.gql` comment,
  `sendWelcomeEmail.ts`), since a request may now run fifteen.
- The composer, text only: send, Enter and Shift+Enter, disabled while a run goes. Drafts: "New
  conversation" opens `/conversations/<createId()>?isNew=true`, the first send creates it, then
  `isNew` leaves the address as knowledge's does.
- Tests (database mocked): claiming twice, an expired lease, fencing, finishing only the active run,
  busy, an unclear and a definite queueing failure, both leaving the run queued for the retry to
  enqueue, a dead run finalized, a send retried with the
  same `messageId`, a fourth run refused, a conversation without room for a run refused. Against the
  emulators, a script under `scripts/` sends from two conversations at once with two runs already in
  flight, and exactly one goes through.
- Verify: locally, send in two tabs and watch the reply arrive; restart the backend mid-run, see the
  run shown interrupted a minute later, and send again. Setup steps 2 to 4 before the release; then,
  as staff in production, the same with the task in Cloud Tasks' logs.

### M6: Claude replies, with web search

- Dependencies: `@anthropic-ai/vertex-sdk` and the `@anthropic-ai/sdk` it builds on. Mind the
  seven-day install cooldown.
- `domain/agent/`: the client and its scripted double, the system prompt and its byte test, the
  context message and its hash, `checkTranscript` and its tests, storing the transcript (the context
  message with the first assistant turn), the request, the streamed turn (progress lines to
  `run.step`), drawing a turn with each insert claiming its positions, `web_search`, usage per model, `preview` and
  `unreadCount`.
- The thread: progress lines in the indicator; web search calls drawn ("Searching the web", output
  listing the results); citations drawn as numbered links after their spans, with the sources under
  the message.
- Tests (scripted client): consecutive requests share a byte-identical prefix; `checkTranscript`
  accepts every flow so far and rejects each broken shape; text blocks merge with their citations'
  offsets kept right; a web search becomes one finished call; usage adds up.
- Verify: setup step 1 and, for development, step 5; ask a question that needs the web and one that
  does not; watch progress lines; check the logs show `input_transformations` empty across turns.

### M7: Stop, resume, retry, failures and refusals

- Routes `…/stop`, `…/resume`, `…/retry`, as The transcript describes, finalizing dead runs.
- The worker: aborting on the stop flag, cancelled calls, notes; failures (`FAILED`, the reason in
  `failure`, a note) after the SDK's retries, at the step and time limits, and on `max_tokens`;
  refusals and their fallback, as The agent describes.
- The composer's Stop button; the notes with Resume and Retry as the design offers them; a run past
  its lease shown as interrupted.
- Tests: a stop mid-stream drops the turn and stores no context message; resume runs the unanswered
  `tool_use` blocks; retry goes back to the run's anchor, for a files-only message and for an
  answer, and its cut passes `checkTranscript`; retrying many times lowers `messageCount` by what it
  deletes, so it never fills the conversation; sending after a stop answers the open blocks; a turn
  with a `fallback` block is stored without the blocks before its boundary.
- Verify: stop during a web search, resume, retry; kill the local backend mid-run and resume after.

### M8: Rich text and Markdown in core

A refactor and two pure functions, no visible change.

- Move the stored rich text model into `strategydance-core/src/helpers/richText/`; the design system
  keeps its class names, gains `strategydance-core` as a workspace dependency and imports the rest
  from it; re-point the web's imports.
- `richTextToMarkdown(blocks)` and `markdownToRichText(markdown)` for the subset, with tests: round
  trips, nesting, check items, links, what degrades to paragraphs, lengths against
  `MAX_DOCUMENT_CONTENT_LENGTH`.
- Verify: the four checks; knowledge, the log, priorities and build in public cards draw as before.

### M9: Knowledge tools and knowledge links

- **A searchable plain text for documents.** `Document` gains `contentText`, the content's plain
  text (`getRichTextText`), `@searchable(language: "simple")` beside a searchable `title`, so
  `search_knowledge` reads an index rather than scanning stored JSON. A null `contentText` means
  "not indexed yet", and nothing else may leave it stale:
  - The backend's knowledge writes set it with the content.
  - The web moves to new operations, `CreateDocumentWithText` and `UpdateDocumentContentWithText`,
    which take `$contentText` as required. The old `CreateDocument` and `UpdateDocumentContent` stay
    for bundles still open from before, with the same variables, and now write `contentText: null`
    alongside the content (their data block is the server's, so the change reaches old bundles too).
  - Existing documents, which start null, are filled by a backfill script under `scripts/`, run by
    hand after the release: it pages through null rows in batches and can stop and resume at any
    point, so no request ever carries it.
  - Before `search_knowledge` reads the index, the backend reindexes up to 20 of the organization's
    null rows, enough for the occasional write from an old bundle. When null rows remain after that,
    the result says the index is still being built and the search may be incomplete, so the model
    can retry later or read the documents it already knows.
  - If the collaborative documents branch has changed how content is stored by then, `contentText`
    follows its writes instead.
- Creating keeps the knowledge cap as `CreateDocument` does: the backend's create locks the
  organization's row and counts fewer than `MAX_DOCUMENTS` live documents before inserting, so the
  agent and the browser cannot race past it, and a full organization comes back to the model as a
  failure it can explain.
- Backend-connector operations: search candidates, read one, create, update (title, aspects, content
  by revision), each guarded on membership, `deletedAt` and, for writes, `isAiLocked`, and named in
  `GetOrganizationDocuments`' refreshes.
- The four knowledge tools, their labels, and the system prompt's knowledge section.
- In the thread, `doc:` links resolve against the organization's live document list: the current
  title, or struck through when deleted.
- Tests: a locked document refuses; a stale revision refuses; a create retried with the same
  `tool_use` id makes one document; a create in a full organization refuses; a 200000-character
  document read in pages that join back whole, and one made of a single 200000-character paragraph
  too; a block range replaced without touching the rest; a unique piece of text replaced inside that
  paragraph, and a text that occurs twice refused;
  search reading the index and loading the plain text of 20 candidates at most; a write through the
  old operations nulling `contentText`, and the next search reindexing it; Markdown in, the document
  draws as written.
- Verify: ask the agent to write a decision into an existing document, then to create one; open them
  in Knowledge; lock one and ask again.

### M10: Mentioning knowledge in the composer

- The "+" menu (with "Mention knowledge" only until M16), the `@` list and its keyboard handling,
  mentions sent as `[Title](doc:<id>)`, all as The composer describes.
- Verify: mention two documents, send, see the links in the bubble and the agent read them.

### M11: Team, log and top priority tools

- Backend-connector operations reading the team (as `GetOrganizationTeam` does, without emails) and
  the log for a range, both checking membership; `get_team` and `read_log`, priorities and entries
  converted with `richTextToMarkdown`.
- `set_top_priority`, through one backend mutation `SetTopPriorityForAgent($organizationId,
  $userId, $topPriority, $date)`: it checks membership, writes the member's own membership row
  (`topPriority` through `markdownToRichText`, then held to both limits the Today page holds it to:
  at most `MAX_TOP_PRIORITY_TEXT_LENGTH` characters of text and `MAX_TOP_PRIORITY_LENGTH` serialized,
  since formatting and long link addresses can pass the second with little text; and
  `topPriorityUpdatedAt`) and upserts their `activityDay` row, two rows written once
  each, with `RecordActivity`'s check that `$date` is the member's today, which the backend computes
  from their stored time zone. Its `$organizationId` matches `GetOrganizationTeam`'s refresh, so an
  open Today page updates at once. `CLAUDE.md` asks every new way of changing Today data to record
  the day.
- Verify: "What is everybody working on?", "What did I log this week?", and "Make shipping the
  pricing page my priority": the Today page updates without a reload, and the build in public streak
  counts the day once the page is reloaded (`GetActivityDays` is not live).

### M12: Questions

- `ask_user`, its `QUESTION` messages, `WAITING` runs with their `pendingToolResults`.
- `POST …/answers` with `{ messageId, selected, other }`, serialized on the waiting run as The
  transcript describes, and skipping on send. The answer is checked against its stored question
  before anything is recorded, since it goes into Claude's transcript: `selected` holds distinct
  options of that question only, at most one for a single-choice question; `other` is one trimmed
  line of at most 500 characters (`MAX_ANSWER_OTHER_LENGTH`); and an answer chooses at least one
  option or writes something.
- The question's waiting state in the thread, "Needs your answer" in the list and on cards, the
  sidebar badge, and questions in previews.
- Tests: an unknown, repeated or second option for a single-choice question refused, an empty
  answer refused, a long `other` refused; two questions in one turn wait for both answers, and two answers sent at once start exactly
  one run; a skipped question's result; the other tools' results go back with the answers, in
  order; a backend stopping between the last answer and its continuation, finished by the answer
  sent again and by the reconcile route.
- Verify: ask the agent to help choose a price, answer with an option and your own words, then skip
  one by typing.

### M13: Aspect tagging, suggestions and the aspect page section

- The tagging side request and its note, as The agent describes.
- The suggestion catalogue: `CONVERSATION_SUGGESTION_IDS` in core (keys like
  `STRATEGY_ONE_METRIC`), the 36 titles and openers in the `conversation` catalogue.
- The conversation route's `aspect` and `suggestion` search params, validated; the aspects button on
  a draft, held in the draft until it is sent; the first message's draft fields (`aspects`,
  `suggestionId`, `title`, `opener`); the opener inserted in the first send's one mutation, at
  position 0 before the member's message, so the first send stays atomic and a retry finds it whole;
  the synthetic first exchange in the transcript.
- The aspect page's Conversations section above Knowledge, as designed, and "New conversation"
  tagged with the aspect.
- Verify: a new conversation about pricing gets tagged; set aspects before sending and it does not;
  start a suggestion and see it leave the cards.

### M14: The dock

- `_ConversationDockProvider` in `router.tsx`'s `Wrap` after `CurrentOrganizationProvider`, with its
  context and `useConversationDock`. Windows are persisted with `usePersistedState` under one literal
  key, holding a map keyed by `${userId}:${organizationId}`, since neither is known when `Wrap`
  mounts.
- The dock in `AppLayout`, inside `SidebarProvider` after `SidebarInset`, `z-40`, hidden on mobile
  and on the conversation page: windows, the "+N" menu, focus, Escape, unread counts and
  `MarkConversationRead` while a window is open, drafts in windows, and "Open in dock" on the list,
  the page and the cards.
- Toasts move out of the dock's corner app-wide (Sonner's `position`), checked on a screenshot.
- Utilities with tests: how many windows fit.
- Verify: open four conversations at several widths; minimize, close, full page; replies arriving in
  minimized windows count up; a phone width has no dock.

### M15: Attachments: storing them and sending them to Claude

- `PUT …/attachments/:attachmentId`: member and staff checks, a rate limit, type sniffing, the size
  and the member's quota of unsent files (after deleting their unsent rows older than two days),
  Claude's image limits and a PDF's page count: the row reserved `UPLOADING` under the membership
  lock, the object streamed under `pending/` with a generation-match-zero precondition, the row
  turned `READY`; stale reservations pruned after ten minutes; deleting a pruned conversation's
  folder.
- The bucket's lifecycle rule deleting `pending/` objects older than two days, applied with gcloud
  like the CORS rule (a human step, written down beside `storage.cors.json`).
- `GET …/attachments/:attachmentId`: current membership and ownership checked, the bytes streamed
  with private cache headers. `storage.rules` stays as it is.
- `POST …/messages` accepts attachment ids, checks the conversation's budget and its PDFs' total
  pages, copies each file into
  the conversation's folder and sets each row's `message` once; the transcript's placeholders and
  the worker's base64 blocks; the serialized request measured, and `isFull` set past the limits.
- `deploy:backend` gains `--memory 2Gi` and `--concurrency 20`, both measured before the release.
- Tests: blocks built from each type; the budget refused; a text file over its length refused, and a
  message whose counted tokens pass 700000; an oversized image refused; a PDF over 100
  pages refused, and one that would pass 300 in the conversation; a member at the cap refused before
  any byte is stored, again and again with new ids; a stale reservation pruned; a retried upload
  finishing its reservation; two sent at once with one id ending with one row; a placeholder replayed
  byte for byte; a conversation marked full.
- Verify: with a script, upload an image, a PDF and a text file, send them, read the reply.

### M16: Attachments in the composer and the thread

- The "+" menu's "Files and images", paste, the tray with upload progress, image shrinking, the
  budget's message; the thread's thumbnails fetched from `GET …/attachments/:attachmentId` with the
  caller's tokens and shown as object URLs, file chips, the image dialog.
- Verify: attach each type from the composer and ask about it; reach the conversation's budget.

### M17: Integrations: the organization's servers

- `OrganizationIntegration`: name, `https` URL, catalogue slug, authentication (`OAUTH`, `API_KEY`
  or `NONE`), `isEnabled`, the key encrypted with Cloud KMS and its last four characters, the OAuth
  client it registered, its tools as last listed (annotations included), `autoApprovedTools` (the
  tools an administrator lets run without the member's approval, empty to begin with), `lastError`,
  `lastUsedAt`, `deletedAt`. The web connector's live list never selects a secret, and says its
  limit (`MAX_INTEGRATIONS`, 50 per organization, refused past that) rather than stopping at the
  default 100 unannounced.
- **The address and the authentication are bound to the credentials.** Changing either clears, in the
  same mutation, everything issued for the old ones: the API key, the OAuth client registered with
  the old server, every member's connection and the pending authorizations. Members reconnect, so no
  credential issued for one origin is ever sent to another.
- The server dialog lists its tools with a switch each for running without approval. A tool's
  `readOnlyHint` is shown beside it as the server's own claim, which may suggest a choice, never make
  one: the MCP specification calls annotations untrusted.
- Backend routes for administrators: add (connects with `@modelcontextprotocol/sdk` over Streamable
  HTTP and lists the tools), edit, delete, turn on and off, retry. Deleting sets `deletedAt`, keeping
  the secrets for Undo, and the next delete prunes what was deleted over a day ago, as documents do.
  Encryption through Cloud KMS, and a local key in development.
- **Every request to a server's address goes through an outbound guard**, since an administrator
  types it: `https` only; the host resolved and refused when any of its addresses is loopback,
  private, link-local, or the metadata server (`169.254.169.254`, `metadata.google.internal`); the
  check repeated on every connection and redirect, so a rebinding or a redirect cannot slip past it;
  timeouts and a cap on the response's size. Cloud Run can reach the metadata server, which hands out
  the service account's tokens, so this is not optional. OAuth discovery and token requests (M18) go
  through the same guard. The connection is made to the address the guard checked, never to a name
  resolved again. A request that carries a credential (an API key, a member's token, a refresh
  token, the registered client's secret) never follows a redirect to another origin: it fails, so no
  secret reaches a host it was not issued for. Only unauthenticated discovery follows redirects, each
  hop guarded.
- The guard ships with deterministic tests, a fake resolver and transport standing in for the
  network: IPv4 and IPv6 private, loopback, link-local and unique local ranges, IPv4-mapped IPv6
  forms, `0.0.0.0`, the metadata names, a resolver whose answer changes between the check and the
  connection, a redirect to a blocked address, a timeout, and a response past the size cap.
- The Integrations page as designed (table, server dialog, gallery with marks in
  `public/assets/images/mcp/`), staff gated, and its sidebar item. Check each catalogue address is a
  real remote MCP server before shipping it.
- Verify: add a key-based server and an OAuth one, turn one off, delete and undo.

### M18: Integrations: members connect their accounts

- `IntegrationConnection`, one per member and server: the account's label, tokens encrypted, expiry,
  status. Pending authorizations: state, PKCE verifier, expiry.
- The OAuth flow MCP servers expect: discovery from the server's protected resource metadata,
  dynamic client registration, authorization code with PKCE and the `resource` parameter, the
  callback at `https://api.strategydance.com/integrations/oauth/callback` redirecting to a web page
  that closes the popup, refresh before expiry, disconnect.
- The page shows each OAuth server's status for the viewer, with Connect and Disconnect for
  themselves, and the design's waiting dialog.
- Verify: connect two members to the same server as different accounts; disconnect one.

### M19: Integrations in conversations

- The three integration tools; calls with the member's own connection or the organization's key,
  30 seconds each; `lastUsedAt`; a 401 marks the connection as needing authentication.
- **The schema change.** `ConversationMessage` gains, for integration calls and approvals:
  `integration` (an optional reference to `OrganizationIntegration`, set to null if the server is
  pruned), `integrationName` (the server's name when the call was made), `integrationToolName`,
  `approvalState` (`PENDING`, `ALLOWED`, `DENIED`), and `argumentsPreview` (the arguments rendered
  for display, cut to 2000 characters, secrets never included since none reach the model). The live
  tail selects these, so a thread draws the server, the tool and the arguments without the full
  `toolInput`, which stays behind "View output". The warning strip is computed against the live
  integrations list matched by `integration`, never by name. All additive, with `APPROVAL` appended
  to the kinds.
- **Approval.** Every integration call waits for the member, unless its tool is in the server's
  `autoApprovedTools`: the run ends `WAITING` on an approval entry (a new `APPROVAL` kind, appended to
  `ConversationMessageKind`) showing the server, the tool and its arguments, with Allow and Deny.
  Allow runs the call in the next run; Deny answers it as refused. Approvals are answered as
  questions are, serialized on the waiting run. A server's annotations decide nothing: a server can
  call a tool that writes read-only, and even a read can carry private text out in its arguments.
  Text that knowledge, the web, a file or another integration slipped into the conversation can
  then propose an action, never take one, except through an auto-approved tool. An administrator who
  trusts a tool can let it run straight away, as the design shows, and that is exactly the exception:
  injected text can make the model call an auto-approved tool at once, with any arguments, including
  private text it carries out. The switch says so beside it, and the page's help asks administrators
  to allow only tools whose effects and reach they accept from anything the agent reads.
- A call that started before a crash is never run again by itself (see A run).
- In the thread, integration calls show the server and the tool, and the warning strip when the
  server is missing, off, or not connected for the viewer, with what fixes it: administrators get
  "Add" or "Turn on", every member gets "Connect" for their own account, others read "Ask an
  administrator…". The Integrations page handles `?open=`, `?connect=`, `?enable=` and `?add=`.
- Verify: ask something that needs a connected server, then allow the call and deny another; let an
  administrator allow one tool and see it run straight away; turn the server off and ask again.

### M20: Launch

- Remove the release gate everywhere, and `ARE_CONVERSATIONS_STAFF_ONLY`.
- `CLAUDE.md`: a Conversations section with what a new tool needs, the transcript's rules and the
  run lifecycle, where earlier milestones have not written it.
- `operations-costs.md`: Vertex, Cloud Tasks and attachment storage, from the recorded usage.
- Before merging: the quota raised, the budget alert set, and the legal page reviewed for AI
  processing, which are David's calls.

## Risks and open questions

- **Spend**: nothing caps usage until credits exist; the budget alert is the guard.
- **Vertex**: partner pricing, the web search price, the request size limit and the quota for
  `claude-opus-5-5` on `global` need checking in the console.
- **Deploys during a run**: Cloud Run should let a running request finish when a revision replaces
  its instance; if not, the lease and Cloud Tasks' retry resume the run.
- **Live query traffic**: progress lines and leases refresh only `GetConversationRun`; each message
  refreshes the open thread's tail of 150 entries and the member's list. Fine at today's scale.
- **The member's open editor**: when the agent changes a document the member has open, their next
  save meets the revision check and asks them to reload, as two people editing do today.
- **Collaborative documents**: the `live-documents` branch, in progress on 2026-10-02, makes
  knowledge documents collaborative with Yjs over Data Connect live queries, and changes the
  `Document` schema and its operations. If it lands before M9, the agent's knowledge writes go
  through its update model rather than replacing `content` under a `revision`; M9 starts by
  reading what is on `dev` then.
- **Prompt injection**: knowledge, the log, the web, files and integrations carry text others wrote,
  and a system prompt is no boundary. The boundaries are what the tools allow: built-in writes reach
  only knowledge, where the AI lock holds, and the member's own top priority; from M19, an integration
  call waits for the member's approval unless an administrator allowed its tool, and every request to
  an integration passes the outbound guard. An auto-approved tool is the stated exception: anything
  the agent reads can get it called at once, so allowing one is an administrator's acceptance of that.
- **Long conversations**: 1M tokens of context is far off; compaction and context editing are
  available (beta on Vertex) if it comes to that.
