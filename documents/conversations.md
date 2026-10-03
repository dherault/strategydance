# Conversations

How Strategy Dance's conversation agents get built: what the design asks for, the decisions taken,
and the architecture. The twenty-four milestones that take the feature from nothing to launch, each one
pull request into `dev` that a Claude Code session can implement, are in
[conversations-milestones.md](conversations-milestones.md), with the conventions every one of them
follows.

Written on 2026-10-02 against `dev` at `4def3a6`, from the Claude Design project "Strategy Dance
Conversations". Reviewed on 2026-10-03 against `dev` at `db4df41`, once live documents had merged:
the agent's knowledge writes, the rich text milestone, the worker and the message cap changed then.
When a decision changes, change it here first.

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
| How a run executes | In the background. The backend queues a Cloud Tasks task, and the task's request runs the agent loop on a private worker service, the backend's image deployed a second time, writing each step to Data Connect. Locally it runs in the backend's process |
| What the agent reads | Knowledge, the organization's profile (name, brief), the whole team (names, job titles, roles, bios, top priorities) and the log. Not tasks or the checklist, which are going away |
| What the agent writes | Knowledge documents, through their shared Yjs text as an editor would, so its edits reach open editors live, never one whose AI lock is on; and the member's own top priority. Not the log, the checklist or tasks |
| Web search | Claude's built-in web search, `web_search_20250305` (the version Vertex offers), from the first agent milestone |
| Attachments | Images, PDFs and text files, read by Claude natively |
| Questions | Multiple-choice questions through a tool, as designed |
| Replies | Whole messages, as designed. The thinking indicator shows live progress. No token streaming to the browser |
| Integrations (MCP) | The last milestones. Administrators choose the organization's servers. Each member connects their own account to an OAuth server, and the agent acts as them. A key-based server's one key serves the whole organization. Every integration call waits for the member's approval, except the tools an administrator has allowed to run without it |
| Usage limits | None yet: a credit system comes later, and a budget alert on Vertex spend, set before the first request, is the guard until then. Every run records its token usage for it. Per-run safety limits on steps and duration stay, and so do bounds on how much runs at once (three runs per member in each organization, fifty dispatches across the queue), which cap concurrency rather than usage |
| Conversation size | One safety cap of 2000 entries, which refuses a send and stops a run, and the measured request, which marks a conversation full before its context window does. No room is reserved ahead |
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
  or in one message's text, the member's or Strategy Dance's, ignoring case. (The prototype also
  matched words spread over several messages, and in questions and notes; the full-text search
  matches within one title or one message's text.) No match:
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
                                                     │ OIDC-signed POST, checked by Cloud Run
                                                     ▼
                         Worker (Cloud Run, private) `/internal/conversation-runs`
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
- **Why the backend's code.** It already verifies callers, holds the Admin SDK and runs on Google
  Cloud's credentials, which is all calling Vertex needs.
- **Why a second service.** The backend is public (`--no-invoker-iam-check`), so an internal route
  there would have to verify Cloud Tasks' and Cloud Scheduler's tokens itself, and a 15-minute run
  holding 32 MB requests would share its instances, timeout and memory with every interactive
  route. `strategydance-worker` is the same image started with `SERVICE=worker`, which mounts the
  internal routes and nothing else, while the backend mounts everything but them. Its invoker check
  stays on, and only the `conversation-tasks` service account may invoke it, so Cloud Run refuses
  any other caller before the code runs and no token verification is written by hand. It has its own
  15-minute timeout, a low concurrency (4) and the memory that concurrency needs, and scales to zero
  between runs. The backend keeps its defaults.

### The data

New tables in `schema.gql`, each commented as the existing ones are:

- **`Conversation`**: `id` (made by the client, as a document's is, so a draft has its id before it
  is stored), `user`, `organization` (both references, as `TaskList` has them, so a member removed
  and invited again finds their conversations), `title`, `aspects`, `aspectsSetBy`
  (`ConversationActor`: `MEMBER` or `AGENT`, null until set), `suggestionId` (the catalogue key it
  started from), `activeRunId`, `isAwaitingAnswer` (set by the write that ends a run `WAITING`,
  cleared by the one that consumes its turn, both of which write the row anyway), `preview` and
  `previewMessageId`, `unreadCount`, `nextRunNumber`,
  `nextMessagePosition`, `messageCount` (what it holds, lowered by Retry), `historyRevision` (bumped
  by Retry), `isFull` (see
  Attachments), `deletedAt`, `pruneClaimedAt`, `createdAt`, `updatedAt` (its last activity). Indexed on `userId`,
  `organizationId`, `updatedAt`.
  - `activeRunId` is the run in flight, null when idle: a plain UUID rather than a reference,
    because the first send writes the conversation and its run in one mutation, and a reference would
    have it write the conversation's row twice, which Data Connect skips.
  - `preview` (`Any`) is what the list and the cards show of the last entry: its kind, up to 200
    characters of plain text, a tool's name and status, a question's state. A core helper,
    `buildConversationPreview`, builds it, whoever inserts the entry writes it, and the web words it
    in the reader's language. The list then selects no message text. Since a question, a tool call
    or an approval changes in place, `previewMessageId` names the entry shown, and whatever changes
    an entry rebuilds the preview after it, conditionally on `previewMessageId` still naming that
    entry, so answering the last question shown turns the list's "Question: …" into "Answered: …".
- **`ConversationMessage`**: what the thread draws. `conversation`, `run` (optional), `kind`
  (`ConversationMessageKind`: `MEMBER_TEXT`, `AGENT_TEXT`, `TOOL_CALL`, `QUESTION`, `ASPECTS`, `NOTE`),
  `text` (Markdown, for the two text kinds), `citations` (`Any`, on agent text, see Drawing a turn),
  the tool call's `toolUseId`, `toolName`, `toolStatus`
  (`RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELLED`), `toolInput` and `toolOutput` (`Any`),
  `toolStartedAt`, `toolDurationMs`, the question's `questionPrompt`, `questionOptions`, `isMultipleChoice`,
  `answerSelected`, `answerOther`, `isAnswerSkipped`, `answeredAt`, the aspects note's `aspects` and
  `aspectsSetBy`, the note's `noteKind` (`STOPPED`, `FAILED`, `REFUSED`, `INTERRUPTED`, `FULL`),
  `position`,
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
  `COMPLETED`, `STOPPED`, `FAILED`, `REFUSED`, `INTERRUPTED`, `CONTINUED`: a waiting run whose turn
  was consumed, see Consuming a waiting turn), `membershipCreatedAt` (the `createdAt` of the
  membership it was started under, see The worker), `step` (the latest progress line),
  `anchorPosition` (where Retry goes back to), `context` (JSON text: its context message until
  stored), `stopRequestedAt`, `leaseExpiresAt`, `attempts`, `pendingToolResults` (JSON text),
  `failure` (for the logs), `usage` (`Any`: tokens and web searches per model, the credit system's ledger), `createdAt`
  (when queued), `startedAt` (when claimed), `endedAt`, and `number`, unique per conversation and
  claimed on the conversation's `nextRunNumber` in the write that starts the run, so the latest run
  is the one with the highest number, never decided by a timestamp tie.
- **`ConversationTranscriptEntry`**: what Claude is sent, kept apart from what the thread draws.
  `conversation`, `run`, `position` (dense from 0, unique per conversation), `role` (`USER`,
  `ASSISTANT`, `SYSTEM`), `content` (the exact content blocks, thinking blocks and their signatures
  included, as JSON text), `contextHash` (on a context message, see The transcript), `drawnBlocks`
  (how many of its blocks the thread has drawn, see Drawing survives a crash). Only the backend
  reads or writes it.
  - **JSON text, never `Any`.** Data Connect stores `Any` as Postgres `jsonb`, which reorders an
    object's keys (shorter keys first), keeps one of two duplicate keys, and refuses a string
    holding U+0000. A `tool_use` block's `input` would come back with its keys in another order,
    which is an edit of the history its thinking blocks were made with, and a text file or a tool
    result holding a NUL character could not be stored at all. So `content`, the run's `context`
    and `pendingToolResults` are `String` columns holding `JSON.stringify` of exactly what was
    sent, which escapes U+0000, and are parsed again only to be sent. The drawn copies (`text`,
    `toolInput`, `toolOutput`, `citations`) drop U+0000 before they are written, since a Postgres
    `text` refuses it too.
- **`ConversationAttachment`**, added with the attachments in M19: `id` (made by the client, also
  the file's name in Storage), `user`,
  `organization`, `conversationId` (a plain UUID rather than a reference, since a draft's files are
  uploaded before the conversation exists), `message` (optional, set when sent), `status`
  (`UPLOADING` while its slot is reserved, `READY` once its file is stored, `PRUNING` once a prune
  has claimed it), `name`, `contentType`,
  `size`, `pageCount` (a PDF's pages, counted when it is stored, null for other files), `tokenCount`
  (its input tokens alone, counted when it is stored, see Attachments), `createdAt`. Unsent, the file waits under `pending/`; sent, it lives at
  `organizations/{organizationId}/users/{userId}/conversations/{conversationId}/{attachmentId}`,
  where `organizations/{organizationId}` is `buildOrganizationStoragePrefix`'s canonical form (hyphens
  removed, as `deleteOrganization` sweeps it), never the route's raw parameter, so deleting the
  organization sweeps it with the rest (see Attachments). Every lookup, budget and prune matches
  `conversationId` together with `userId` and `organizationId`: a draft's id is reserved by nothing,
  so another member who learned it could make rows under it, and an upload is also refused when a
  conversation with that id exists and is not the caller's. Indexed on those three, for pruning and
  the conversation's budget, and on `userId`, `organizationId`, `createdAt`, for the quota's count of
  unsent rows and their pruning.

Limits go in strategydance-core beside the others. Per member and organization:
`MAX_CONVERSATIONS` (1000), `MAX_ACTIVE_RUNS_PER_MEMBER` (3), `MAX_PENDING_CONVERSATION_ATTACHMENTS`
(30). Per conversation: `MAX_CONVERSATION_MESSAGES` (2000), `MAX_CONVERSATION_ATTACHMENTS_SIZE` (15
MiB), `MAX_CONVERSATION_PDF_PAGES_TOTAL` (300). Per run: `MAX_CONVERSATION_RUN_ENTRIES` (100),
`MAX_TOOL_CALLS_PER_RUN` (50), and `MAX_TOOL_CALLS_PER_TURN` (10). Per search:
`MAX_SEARCH_QUERY_LENGTH` (100), `MAX_SEARCH_TERMS` (8), `MAX_SUBSTRING_SEARCH_MESSAGES` (20000) and
`MAX_SUBSTRING_SEARCH_DOCUMENTS` (100). Per item:
`MAX_CONVERSATION_TITLE_LENGTH` (120), `MAX_CONVERSATION_MESSAGE_LENGTH` (20000),
`MAX_CONVERSATION_ATTACHMENTS_PER_MESSAGE` (10), `MAX_CONVERSATION_ATTACHMENT_SIZE` (10 MiB),
`MAX_CONVERSATION_PDF_PAGES` (100), `MAX_CONVERSATION_TEXT_ATTACHMENT_LENGTH` (200000),
`MAX_QUESTION_OPTIONS` (6), `MAX_QUESTION_PROMPT_LENGTH` (1000), `MAX_QUESTION_OPTION_LENGTH` (200),
`MAX_ANSWER_OTHER_LENGTH` (500). And `CONVERSATION_ATTACHMENT_CONTENT_TYPES`,
`CONVERSATION_SUGGESTION_IDS` (M17), the release gate `ARE_CONVERSATIONS_STAFF_ONLY`, and the error
codes `ERROR_CODE_CONVERSATION_BUSY` and `ERROR_CODE_CONVERSATION_FULL`.

### Who writes what

- **The web connector** (`USER`, every operation keyed by `auth.uid` and by the caller's current
  membership, with the predicate `GetTaskLists` uses, and every mutation checking that membership in
  its transaction: conversations outlive a member's removal, so ownership alone would leave a former
  member reading them. Every read also filters the conversation on `deletedAt: { isNull: true }`, as
  `GetOrganizationDocuments` does, the list, the conversation, its history, its run, a tool call and
  both searches alike; only `RestoreConversation` reaches a deleted one. The backend's routes refuse a
  deleted conversation too, and its worker stops at its next write once the conversation is deleted):
  - `GetConversations($organizationId)`, live, read by the conversations page alone: the list,
    `limit: 1000`, ordered by `updatedAt` then `id` (a query without a limit stops at 100), each
    conversation's fields, `preview` and `isAwaitingAnswer` included. It refreshes on run start and
    end, answers, create, delete, restore and aspects, on `mutation.variables.userId ==
    request.auth.uid && mutation.variables.organizationId == request.variables.organizationId`, as
    the next three do. Not on the messages a run inserts, nor on read: while a run goes the list
    shows "Thinking…" from `activeRunId`, and it shows no unread count, so the hundred inserts of a
    long run would each resend up to a thousand rows, about 400 KB, to a list that draws the same
    thing. The run's last write sets the preview it then shows.
  - The app-wide reads stay small, so a message insert never sends a thousand rows to every tab:
    `GetConversationsAwaitingAnswer($organizationId)`, live, for the sidebar's badge and the dock's
    "+N" dot, the ids of the member's conversations with `isAwaitingAnswer` (`limit: 1000`, as many
    as a member can have, so the count is exact; ids alone, at most 36 KB),
    refreshed only by what sets or clears it (a run ending, a waiting turn consumed) and by delete
    and restore; `GetDockConversations($organizationId, $ids)`, live, for the dock, the conversations
    its windows hold (at most 20) with their title, `activeRunId`, `unreadCount` and
    `isAwaitingAnswer`, refreshed by message inserts and read too, since a minimized window counts
    unread replies and clears them; and `GetAspectConversations($organizationId, $aspect)`, live, for the aspect page's
    section, its latest four, three drawn and the fourth saying older ones exist, refreshed as the
    list is.
  - Every live conversation query, this one, `GetConversation` and `GetConversationRun`, also
    refreshes on `RemoveOrganizationMember` and `DeleteOrganization`, on their `organizationId`, as
    `GetOrganizationDocuments` does: filtering on current membership only protects the next read, so
    an open subscription must re-run, and come back empty, the moment its reader is removed or the
    organization is deleted.
  - `GetConversation($organizationId, $id)`, live: one conversation and its latest 150 messages,
    more than one run can draw (see Size), so Retry's deletions usually fall inside it;
    when aspects notes written during a run push its first entries into a history page, the page
    drops the retried runs' messages there by run id (see Retry),
    newest first, with only what changes in place or is small: kind, position, run, a tool's name,
    status and duration, a question's answer, an approval's state. Never the bodies,
    which never change once written: `text`, `citations`, a question's prompt and options,
    `argumentsPreview`, attachments. `toolInput` and `toolOutput` stay out of both, since a call's
    output arrives after its message: the dialog reads their current values through
    `GetConversationToolCall` each time it opens. The page reads each
    message's body once, as its id first appears, through `GetConversationMessageBodies($organizationId,
    $id, $messageIds)` (not live, up to 50 ids a call), and keeps it by id, so a refresh carries a
    few hundred bytes a message, about 45 KB for a full tail however long the replies, and a
    reply's text crosses the network once. Only this tail is live, so a new entry never sends a long
    thread again. The page merges each pushed tail into
    what it holds rather than replacing it: an entry that slides out of the tail stays in its cache
    as history, where only Retry's deletions change it, and whenever the oldest position of the
    tail does not meet the newest it holds (after a long disconnect, say), it fetches the gap with
    `GetConversationMessagesBefore`, so no entry ever falls between the two.
  - `GetConversationMessagesBefore($organizationId, $id, $beforePosition)`: the 100 messages before a
    position, bodies included, read once when the reader scrolls up to them. History changes only by Retry's
    deletions, and every Retry bumps the conversation's `historyRevision`, which the live
    `GetConversation` carries: each tab seeing it change rebuilds what it holds from the fresh tail
    and its history pages fetched again, dropping every entry neither returns, so a deleted run
    disappears in every tab, entries it kept from an older tail included, not only in the one that
    retried.
  - `GetConversationRun($organizationId, $conversationId)`, live: the latest run (the highest
    `number`), with its status, trigger, step, `createdAt`, `startedAt` and
    `leaseExpiresAt`; the indicator times a queued run from `createdAt`. Progress lines and lease
    renewals refresh this small
    query only, not the thread or the list.
  - `GetConversationToolCall($organizationId, $messageId)`: one call's input and output, read once
    when "View output" opens.
  - Search is not a web operation: a search field returns message rows, which cannot be grouped by
    conversation, so it goes through the backend (see the next point and M12).
  - `DeleteConversation` (sets `deletedAt` and asks the active run to stop: two rows, each written
    once), `RestoreConversation`, `MarkConversationRead` (passing the `previewMessageId` it rendered,
    and clearing `unreadCount` only while that is still current, so a reply that lands meanwhile
    stays unread), and `UpdateConversationAspects` (the
    aspects as the member's, and the aspects note at a position claimed on the counter, refused
    once `messageCount` has reached `MAX_CONVERSATION_MESSAGES`, when the dialog says the
    conversation is full; the web retrying with the new counter when the worker got there first). A web mutation takes `$userId` so the list's
    refresh condition can match it, and checks `vars.userId == auth.uid`.
  - `RestoreConversation` holds `MAX_CONVERSATIONS` as creating does: both lock the member's
    membership row first and recount, as `RestoreDocument` locks the organization's, so deleting,
    creating and undoing cannot pass the cap.
- **The backend** does everything else, through backend-connector operations that are `NO_ACCESS`
  and take the verified `$userId`: creating a conversation, every message and transcript entry,
  runs and their leases, uploads, and pruning (rows, the conversation's `ConversationAttachment` rows
  by `conversationId`, which no reference cascades to, and its Storage folder), when it creates a
  conversation, the member's conversations deleted over a day ago, with their files. A prune first
  claims each conversation, setting `pruneClaimedAt` only where it is still deleted past the window
  and unclaimed, and `RestoreConversation` refuses a claimed one, so Undo and a prune never both
  win; files and rows go only after the claim, and every sweep also finishes the conversations
  claimed before and still present, its deletions idempotent, so a prune that failed after claiming
  is completed by the next. Each milestone adds the operations it
  calls: changing an operation's variables later is a breaking connector change, which stops a
  release.
- **Search** is the backend's too: `POST …/conversations/search`, the query in the JSON body so
  private search terms never sit in a logged URL, runs Data Connect's full-text
  search through an index. `Conversation.title` and `ConversationMessage.text` are `@searchable`
  (the `simple` configuration, for seven languages), read with `queryFormat: PLAIN`, which requires
  every word: titles in one query (`limit: 1000`), and member and agent messages paged 500 at a
  time by relevance, collecting distinct conversations until there are 1000 or ten pages have been
  read. Both filter on the caller, their membership and `deletedAt`. Results are the best matches,
  not a guaranteed full set: a few conversations with thousands of matching messages can use up the
  pages, so when the pages run out the list says it shows the best matches and invites a narrower
  search.
- **Chinese and Japanese need another path.** The `simple` configuration splits words on spaces and
  punctuation, which Chinese and Japanese text does not use, so it cannot find a word inside a
  sentence. A query holding CJK characters runs as substring matches instead: split on spaces as any
  query is, each term becomes its own `pattern: { like: "%term%", ignoreCase: true }` filter (Data
  Connect's `String_Pattern`; `contains` is case-sensitive), escaped, and all of them are required
  in the same title or the same message's text, so every word still has to appear, and a term
  without spaces matches as written. No index serves such a match, so the path reads a bounded
  corpus rather than everything the member has: the titles of all their conversations (at most
  1000), and the messages of their most recently active ones only, taken newest first by
  `messageCount` until they reach 20000 (`MAX_SUBSTRING_SEARCH_MESSAGES`), so one search scans at
  most 21000 rows, and the list says it searched recent conversations. Knowledge search does the
  same on the titles of all the organization's documents and the `contentText` of the 100 most
  recently updated (`MAX_SUBSTRING_SEARCH_DOCUMENTS`), still at most 20 candidates. Tests run a
  search in both languages.
- **Every search is bounded at the door**: a query of at most 100 characters and 8 terms
  (`MAX_SEARCH_QUERY_LENGTH`, `MAX_SEARCH_TERMS`), refused with a 400 past either, which the field
  enforces as the member types and `search_knowledge`'s schema enforces for the agent. The field
  waits 300 ms after the last keystroke and aborts the request it replaces. Since a caller can
  skip the field, the route is metered on the server in two layers, as invitations are:
  `conversationSearchRateLimitMiddleware` (120 searches per caller in ten minutes, keyed by the
  verified caller, the address only if there is none, counted in the instance's memory) turns a
  script away cheaply, and the database holds the bound across instances, which autoscaling would
  otherwise multiply: the route's first mutation locks the caller's membership row, as a run start
  does, then inserts a `ConversationSearch` row (the caller, the organization, `createdAt`, indexed
  on the three) only while fewer than 120 of the caller's rows in that organization are younger
  than ten minutes, a read of at most 120 under `@check`. The allowance is per organization, the
  scope the locked row has, so the lock serializes exactly what it counts: two instances at once
  cannot both see 119, and every instance draws on one allowance. Both refuse with `ERROR_CODE_TOO_MANY_REQUESTS`, which somebody
  searching never reaches, and the daily sweeper deletes rows over a day old. The agent's searches
  are bounded by its tool calls per run instead.
- Every operation that changes what a live query shows is named in its `@refresh`. The agent's
  knowledge writes are added to `GetOrganizationDocuments`' refreshes, and its folds to
  `GetLiveDocument`'s, on the document's id, so an open editor sees the revision move; its top
  priority writes go to `GetOrganizationTeam`'s.

### A run

```text
member action ─▶ backend route ─▶ run QUEUED, activeRunId set, task queued ─▶ 202
worker: claim (RUNNING, lease) ─▶ loop: request Claude ▸ record the turn ▸ run the tools ─▶ end
end: COMPLETED │ WAITING (questions) │ STOPPED │ FAILED │ REFUSED │ INTERRUPTED, activeRunId cleared
later: WAITING ─▶ CONTINUED, once an answer or a send consumes its turn
```

- **One run at a time per conversation.** The first send inserts the conversation with
  `activeRunId` already set. A later action locks it with `conversation_updateMany(where: { id,
  userId, activeRunId: { isNull: true } })` and `@check(this == 1)`, then inserts the run; a
  conversation already running answers `ERROR_CODE_CONVERSATION_BUSY`.
- **Leases.** A claimed run's `leaseExpiresAt` is sixty seconds out, renewed every twenty; past it,
  the run is dead. A queued run's lease (twenty minutes) only says when to ask Cloud Tasks again,
  since a backlog can outlast any deadline: past it, a route looks the named task up and pushes the
  lease back while the task exists; once it is gone, or never existed, the run is dead. Send,
  answer, stop, resume and retry first finalize a dead active run as `INTERRUPTED` (running calls
  `CANCELLED`, a note, `activeRunId` cleared). The web shows a claimed run past its lease as
  interrupted, with Resume and Retry, and a queued one as waiting, calling `POST
  …/runs/:runId/reconcile` every two minutes meanwhile, so a run whose task vanished never spins
  forever, with nothing asked of the member.
- **The worker** claims a run with a conditional update (`QUEUED`, or `RUNNING` past its lease) that
  increments `attempts`. It answers 200 only once the run is finished, or was already, and 503 while
  another worker holds a live lease, so Cloud Tasks tries again later; the queue's backoff (90
  seconds) outlasts the lease. The claim, and every fenced write after it, also require the
  membership the run was started under: the run records its `UserOrganization` row's `createdAt`
  (`membershipCreatedAt`), and every check matches it, so removing a member stops their runs at the
  next step (no more of the organization's context goes to Claude, and no tool runs for them), and
  a member invited back, whose new row has a new `createdAt`, never passes for an old run. A worker
  that finds the membership gone or changed finalizes the run there as interrupted, in a write
  fenced on the run alone, with its note, so no delivery is left for a re-invitation to resume.
- **Fencing.** Every worker mutation starts with `conversationRun_updateMany(where: { id, status: {
  eq: RUNNING }, attempts: { eq: $attempt } })` under `@check(this == 1)`, so a worker whose run was
  finalized or claimed again writes nothing more. It is the run row's only write in the mutation (a
  later one would be skipped), carrying whatever changes on the run: a lease renewal, a step, usage,
  the terminal status and `endedAt`.
- **Usage is a ledger.** The fenced write before each request reserves it, with its estimated input
  (the last request's input plus what was appended); the write that stores its turn settles it with
  the real usage. A worker taking over after a crash charges an unsettled reservation at its
  estimate, with a conservative output allowance, marked as estimated: every request is billed, and
  the credit system knows which figures are estimates.
- **Queueing.** A task is named after its run, so creating one is idempotent: `ALREADY_EXISTS` counts
  as success, and an error that leaves it unclear whether the task exists (a timeout, `UNAVAILABLE`)
  is retried with the same name. Even a definite refusal leaves the run `QUEUED`, so every run
  start stays idempotent: the route answers 503 and the browser retries. Any route that meets the
  conversation's active run still `QUEUED` first creates its named task again, then answers with
  that run's id when the same action started it (a send's `messageId`, or the same trigger for
  Resume, Retry and an answer's continuation) and `ERROR_CODE_CONVERSATION_BUSY` otherwise, so a
  Resume whose note is already gone, or a Retry whose cut is already made, is finished by its own
  retry rather than by the reconcile route. A run whose task never comes to exist, because the
  retry never came, is found by the reconcile route once its lease passes (see Leases) and
  finalized as interrupted, with Retry.
- **Recovery and side effects.** A call's message is written `RUNNING`, with `toolStartedAt`, before
  the call is made. A worker that claims a run after a crash finds calls that started and have no
  result. Every built-in write (creating or editing knowledge, setting the top priority) stores its
  effect and its call's result in one mutation, beside the fenced run write, so after a crash it
  has either happened, and its message holds its result, or not happened at all: a call with no
  result runs again, a read like any other, and nothing is applied twice, not even an `append`. An
  integration call is the exception, since it happens on another server: one that started and has
  no result is marked failed, and its result tells the model it was interrupted and may have run, so
  the model checks or asks.
- **Limits.** At most 25 requests to Claude and 10 minutes per run (the task's dispatch deadline and
  the worker service's timeout are 15 minutes); at most 60 seconds per tool call. A run that hits one fails
  with a note.
- **Size.** One cap on the conversation, beside the run's own limits, with nothing reserved ahead.
  Both are checked before each request to Claude, never after it, so no paid turn is thrown away:
  - A run sends no further request once it has drawn `MAX_CONVERSATION_RUN_ENTRIES` (100) entries,
    and ends `FAILED` with a note, as at its other limits (see Limits).
  - A run sends no request once the conversation holds `MAX_CONVERSATION_MESSAGES` (2000) entries,
    and ends `FAILED` with a `FULL` note, "This conversation is full. Start a new one to go on.",
    which offers Retry and not Resume. A run that starts at the cap, from an answer, Resume or a
    Retry that freed too little, ends so at once and costs nothing, which is how a question waiting
    in a full conversation is still answered and its badge cleared.
  - The turn in flight is always drawn whole, so a run can end one turn and its note past either
    bound: a turn draws at most ten calls, five searches and the pieces of one reply, and the live
    tail of 150 still holds a whole run.
  - The send route refuses with `ERROR_CODE_CONVERSATION_FULL` once `messageCount` has reached
    `MAX_CONVERSATION_MESSAGES`, or once the worker has set `isFull` (see Attachments), and an
    aspects note is refused at the same count. Retry is never refused: it deletes what the retried
    runs drew, so it gives that room back.
  - `messageCount` counts what a conversation holds, not the sequence: each insert raises it as it
    claims its position, and Retry lowers it by what it deletes.
  - The cap bounds storage and the history a reader pages through. What fills a conversation in
    practice is its context, which the worker measures before each request, from M9: a request past
    the limits Attachments gives is not sent, the conversation is marked `isFull`, and the run ends
    with the same `FULL` note.
- **Concurrency**, bounded rather than metered: at most three runs in flight per member in each
  organization (`MAX_ACTIVE_RUNS_PER_MEMBER`, refused with `ERROR_CODE_CONVERSATION_BUSY`), and the
  queue dispatches at most 50 tasks at once. A run-start mutation locks the member's membership row
  (as creating and restoring do), counts their runs holding a dispatch, `QUEUED` or `RUNNING`, and
  inserts, so two sends at once cannot both find room. A `WAITING` run has ended and cleared
  `activeRunId`, so unanswered questions never use the allowance; the run an answer starts is
  counted like any other, and when the allowance is full it starts later, through the answer sent
  again or the reconcile route, as after a crash (see The transcript); before counting, the route finalizes every dead run the member has in that
  organization, so crashes elsewhere never lock them out.
- **The loop.** A manual loop rather than the SDK's tool runner, because a run stops for answers and
  carries on in another request, and every step is written as it happens. Each turn: read the stop
  flag; build the request from the transcript and check it (see The transcript); stream it, writing
  each progress line to `run.step` at most once a second and checking the stop flag every two
  seconds; store the finished assistant turn; draw it as messages; then by `stop_reason`:
  - `end_turn`: done, `COMPLETED`.
  - `tool_use`: run the turn's tools in transcript order, consecutive read-only built-in calls
    (`search_knowledge`, `read_knowledge`, `get_team`, `read_log`) four at a time, and each write and
    integration call alone, so writes land in order; record each result on its message, store one
    user entry with every `tool_result` in order, and go round again. A turn runs at most ten calls
    and a run fifty (`MAX_TOOL_CALLS_PER_TURN`, `MAX_TOOL_CALLS_PER_RUN`); a call past either is not
    run, and its result says so. A turn with `ask_user` runs its other tools, keeps their results in
    `pendingToolResults`, and ends the run `WAITING`.
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
- **A long reply is drawn in pieces.** Agent text keeps the bound every message keeps,
  `MAX_CONVERSATION_MESSAGE_LENGTH` (20000 characters), though one turn may write far more: a longer
  text is drawn as several `AGENT_TEXT` pieces, split between top-level Markdown blocks (between
  the model's text blocks first), at a line break only for a single block past the bound, and, for
  a single line past it, at the last space before the bound, else at the last grapheme boundary
  (`Intl.Segmenter`), so a piece never splits a character or a cluster and every piece fits. Each
  citation stays with the piece its span starts in, its offsets rebased to that piece and its span
  clipped at the piece's end. The thread draws consecutive pieces as one reply, and only the first
  adds to `unreadCount`. The transcript keeps the model's blocks as they came, since pieces are only
  a drawing, and each piece's id adds its index to the entry and block it derives from. The live
  tail carries no text (see Who writes what), so a long reply costs the network once.
- **Drawing survives a crash.** A turn is stored in the transcript first, then drawn block by block,
  so a crash can fall between the two. Each drawn message's id derives from its transcript entry and
  block index, so drawing it twice is a conflict rather than a duplicate, and the entry keeps a
  cursor, `drawnBlocks` (with the piece, within a long text), advanced in the same mutation as each
  message it draws. A worker that claims
  a run after a crash first draws the rest of the last entry, from its cursor. It then deals with the
  entry's tool calls: a call whose message exists but which never started is handled as Recovery and
  side effects says, and a call that had no message yet gets one and runs like any other.
- **Ending.** One mutation: the fenced write gives the run its status, `endedAt` and usage, and the
  conversation's `activeRunId` is cleared, only where it still names this run, in the same write
  that sets `isAwaitingAnswer` when the run ends `WAITING`.

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
  mutation. An approval (M23) is answered the same way.
- **The continuation survives a crash between the two.** Starting it is idempotent (see Consuming a
  waiting turn) and reachable from three places: the answer route right after the answer, the same
  answer sent again (it finds the answer recorded, counts none left and starts it), and the reconcile
  route, which the page also calls when it sees a waiting run whose questions are all answered. A
  backend that stops between the two mutations leaves a state the next of those finishes.
- **Consuming a waiting turn.** A send and the last answer can race for the same waiting turn, so
  every mutation that starts a run on one (the answer's continuation, or a send) moves the waiting
  run from `WAITING` to `CONTINUED`, with `conversationRun_updateMany(where: { id, status: { eq:
  WAITING } })` under `@check(this == 1)`, as its only write to that run, together with taking the
  conversation's `activeRunId` and clearing its `isAwaitingAnswer`, in one write to that row.
  `CONTINUED` never waits again, so a delayed loser, even one arriving after the winner's run has
  finished and cleared `activeRunId`, finds nothing to consume. Whichever commits first starts the run and builds the results
  from the questions' states at that moment; the other finds the turn consumed: a send gets
  `ERROR_CODE_CONVERSATION_BUSY` and is retried by the browser, an answer's continuation does nothing,
  its answer already sent with the winner's results. A script under `scripts/` races an answer
  against a send in the emulators.
- **Stop** (`POST …/stop`) sets `stopRequestedAt`. The worker aborts the stream (the turn being
  written is dropped), or lets the calls already running finish and records them, so nothing is left
  in doubt, and cancels the ones not started: they become `CANCELLED`, a `STOPPED` note is added, the
  run ends `STOPPED`. A dead run is finalized by the route itself, and so is a run still `QUEUED`,
  at once and conditionally on its still being queued, so the member can send again straight away;
  its task, if it is delivered later, finds the run finished and does nothing.
- **Resume** (`POST …/resume`), offered when the last entry is a stopped or interrupted note: the
  note goes, lowering `messageCount` in the same mutation, and a run starts, which ends at once
  with the full note when the conversation is at its cap (see Size). When the transcript's last entry holds unanswered `tool_use` blocks, the
  run executes the calls that never started and the built-in ones that have no result (their
  messages go back to `RUNNING`),
  answers an integration call that had started as interrupted (see A run),
  stores the results, then sends its context and the request; when the last entry is `USER` (the
  stream was cut), it sends its context and the request straight away.
- **Retry** (`POST …/retry`), offered with a stopped, interrupted, failed, refused or full note: every run
  records `anchorPosition` when it is created, before anything runs: the `USER` entry that started
  it (a message, files only included, or answers), and for a resumed run the anchor of the run it
  resumes, since it carries that run's response on and its own results entry may never be stored
  if it crashes first. Retry cuts the transcript after the last run's anchor, its context message
  included, deletes the messages drawn by every run on that anchor (the last run and the runs it
  resumed), and starts a run on that anchor with a fresh context message; the remaining prefix is
  what the thinking blocks were made with, and what the cut part wrote stays written. The same
  mutation lowers `messageCount` by what it deletes, bumps `historyRevision`, rebuilds the preview
  from the last entry kept, and sets `unreadCount` to 0: the member is looking at the conversation
  they retry, and the replies it counted are gone, so a `MarkConversationRead` still in flight,
  whose guard then fails, leaves nothing stale and the next reply counts from 0. The route
  answers with the removed runs' ids, and the page drops their messages from every page it holds,
  history included, since aspects notes can push a run's first entries out of the live tail.
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
  unsent rows: it is claimed first, turned from `UPLOADING` to `PRUNING` only while still stale (an
  upload retry refuses a `PRUNING` row, and its own move to `READY` requires `UPLOADING`), then its
  pending object is deleted, and only then the row, which stays, still counted, when the delete
  fails, to be tried again on the next prune. Each upload runs that prune for the caller before it
  counts, and the daily sweep is the fallback for a member who never uploads again. So a failed
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
  conversation. So is a PDF over 100 pages, counted from its page tree when it is stored and kept in
  `pageCount`, and sending refuses files that would take a conversation's PDFs past 300 pages in
  all, summing the stored counts of its sent PDFs and the new ones, so nothing is parsed twice,
  since every replay carries them all.
  Claude takes up to 600 pages a request on a 1M-token model such as Opus 5.5 (100 on 200k-token
  ones), which leaves a margin.
- Every id in an object's name is canonical: parsed as a UUID, then written lowercase without
  hyphens, as `buildOrganizationStoragePrefix` writes the organization's, never the route's raw
  parameter, since the backend accepts an id with or without hyphens and Data Connect returns them
  without. One attachment then has one pending object and one copy, however a retry spells its
  ids, which the quota and the create-only writes rely on.
- An upload lands under `pending/{organizationId}/{userId}/{attachmentId}`, outside `organizations/`,
  where a bucket lifecycle rule deletes what is two days old: a draft never sent costs nothing for
  long, whether or not its author comes back. Sending checks the conversation's budget and copies
  each file into the conversation's folder,
  `organizations/{organizationId}/users/{userId}/conversations/{conversationId}/`, before the
  mutation that sends the message, each copy under a generation-match-zero precondition (a
  collision of the same size counts as done), so a retried send copies only what is missing. With
  no retry, the row stays unsent, and its pruning deletes its pending object and any copy.
- **Removing an unsent file** goes through `DELETE …/attachments/:attachmentId`, which the tray's
  remove button calls: it takes only the caller's own unsent row, matched with its conversation,
  owner and organization, and runs the prune's claim-then-delete on it at once, so its slot frees
  straight away rather than in two days. It is idempotent, answering the same when the row is
  already gone, and refuses a sent file, which only its conversation's deletion removes.
- **Reading a file goes through the backend too**: `GET …/attachments/:attachmentId` checks that the
  caller is still a member and owns the conversation, and streams the bytes with private cache
  headers; the thread fetches it with the caller's tokens and shows it as an object URL. A Storage
  rule could check only the uid, which stays true after a member is removed, so `storage.rules` keeps
  granting clients nothing under `organizations/`, as it does today.
- Claude receives images as `image` blocks and PDFs as `document` blocks, both base64 since Vertex
  has no Files API, and text files as `document` blocks with a `text` source, decoded, so the model
  reads the text rather than its encoding. A request takes about 32 MB, every
  earlier file included, so a conversation's files are capped at 15 MiB (about 20 MB encoded) and a
  text file at 200000 characters (`MAX_CONVERSATION_TEXT_ATTACHMENT_LENGTH`), and a message with
  files is sent only while the next request stays under 700000 input tokens. Building that request
  to count it would put every earlier file in the backend's memory, so each file is counted once,
  alone, once it is stored (Vertex has the count endpoint), into `tokenCount` on its row as its
  pages go into `pageCount`. The send route starts from the last request's whole input, from its
  stored usage (`input_tokens` with `cache_read_input_tokens` and `cache_creation_input_tokens`,
  which the API reports apart although they fill the context alike), and its `output_tokens`, since
  its input already carried every earlier file and its output is in the transcript now; adds
  everything appended since that holds no file (tool results, the next context message, the
  member's text), counted by the endpoint on a request holding only that text, which is small and
  holds no estimate a script or an emoji could beat; and adds the new files' stored counts. A first
  message counts its context and text the same way. The worker's check before each request sums
  the same way. The upload streams into Storage as before, and the count reads the
  stored object back, at most two at once per instance, so the backend's memory stays bounded
  however many arrive. Before each request the worker measures the body: past 30 MB, or 800000
  input tokens, it marks the conversation full, and the send route refuses new messages with
  `ERROR_CODE_CONVERSATION_FULL`. Retry clears the flag as it cuts the tail, and the worker measures
  again before the retried request, setting it back only if the shortened request is still too
  large, so a retry that brings it under the limits frees the conversation. A request holds its
  files about four times over (the bytes, their base64, the JSON body, the SDK's copy), about
  130 MB at the limit, so the worker service is sized for its concurrency rather than budgeting
  memory in code: four runs an instance (`--concurrency 4`) at the limit hold about 520 MB, which
  `--memory 2Gi` holds with room for the runtime. The backend's own routes never build a request,
  so its instances keep their defaults.

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
  top-level automatic caching for the conversation's tail; the tools with strict schemas and
  `eager_input_streaming: true`, as the skill recommends for streamed requests, so every input is
  validated with zod before it runs; `tool_choice` left at `auto` (Opus 5.5 refuses forced tool use).
- **Thinking cannot be turned off** on Opus 5.5. Under `display: "updates"`, a thinking block with
  text is a short progress line ("Comparing revenue with September"): it becomes `run.step`, which
  the thinking indicator shows, which is what the design's rotating steps are. Without one, the
  indicator shows the running tool's label, else "Thinking".
- **Refusals** come back as `stop_reason: "refusal"`. Vertex has no server-side fallback, so the
  client uses the SDK's client-side refusal fallback to `claude-opus-5`, with one `BetaFallbackState`
  per run, since it scopes the pinning. `display: "updates"` is documented for Opus 5.5, not Opus 5,
  and the middleware sends the fallback the same body: M1's probe checks with a real call what Opus 5
  accepts, and the fallback strips what it does not. Before storing a turn that holds a
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
- **A suggestion's opener** is never stored as something Claude said, since its text comes from the
  browser: the backend accepts only a `suggestionId` from `CONVERSATION_SUGGESTION_IDS`, and the
  title and opener the browser sends with it, in the member's language, bounded in length. The first
  user entry carries them as the member's context, "[The member started this conversation from the
  suggestion “title”, which asks: “opener”.]", followed by the member's reply in the same entry. The
  thread shows the opener as Strategy Dance's first message, which only the member, who chose it,
  can see.
- **Tagging aspects**: on a conversation's first run, unless the member set its aspects, a side
  request (structured output, effort `low`, no tools) picks one to three aspects from the first
  exchange. It writes them with the note only where `aspectsSetBy` is still null. It goes through
  the same accounting as the run's own requests: reserved before it is sent, settled into the run's
  `usage` after, and counted toward the run's 25 requests.

### Tools

| Tool | What it does | Milestone |
| --- | --- | --- |
| `web_search` | Claude's server tool, `web_search_20250305`, at most 5 searches a request | M9 |
| `search_knowledge` | `{ query, aspects?, limit? }`: up to 10 documents, with id, title, aspects, `updatedAt`, `isAiLocked` and an excerpt, found by Data Connect's full-text search on `Document.title` and a new `Document.contentText` (see M14), through an index rather than a scan, at most 20 candidates, whose plain text alone is loaded to cut the excerpts | M14 |
| `read_knowledge` | `{ id, from? }`: a document's title, aspects, `version` and text, as a list of its top-level blocks, each with its id and its Markdown, up to 40000 characters at a time, with `next` when more remains, since a document can hold 200000 and a tool result is cut at 50000. The text is the shared one, its snapshot with every pending update merged, never `content`, which lags until the next compaction, and the ids are the shared text's own block ids, which stay with a block while others are typed around it. `version` is a hash of the whole text. The cursor is a block's id and an offset within it, so a page ends at a block's end when it can and inside a block only when one block alone passes the budget, as a single 200000-character paragraph would, and the next page carries on from that block however the text around it changed. The cursor also carries a hash of the block it stopped inside, so an edit inside that block sends the model back to the block's start, and a cursor whose block was deleted back to the document's start, rather than repeat or skip text | M14 |
| `create_knowledge` | `{ title, aspects, content }`: a new document, content in Markdown, stored as its first Yjs snapshot with `content` and `contentText` beside it, in the mutation that records the call's result. Its id derives from the `tool_use` id, so a run retried after a crash finds the one it made rather than making two | M14 |
| `update_knowledge` | `{ id, version?, title?, aspects?, content?, append?, replaceBlocks?, replaceText? }`: `content` replaces a document small enough to read whole, `append` adds to the end, `replaceBlocks: { fromId, toId, content }` replaces the blocks from one id to another, and `replaceText: { find, replace }` replaces one exact occurrence of a piece of text, refused unless it occurs exactly once, so a large document, or one oversized block, is edited without being rewritten. The edit is applied to the shared text as members' edits are, merging with what they type meanwhile (see Rich text and Markdown). Refused when the AI lock is on ("The team locked this document against AI changes. Tell the member instead."); for `content`, which rewrites everything the model read, when it comes without the `version` `read_knowledge` gave or the text is no longer that version, before anything is written; and for `replaceBlocks`, when either block is gone ("The document changed since you read it. Read it again first."). Everything else finds its place afresh, so it goes through while somebody types elsewhere in the document | M14 |
| `get_team` | `{ cursor? }`: the members, 25 at a time ordered by when they joined then id, each with id, name, job title, role, bio, top priority as text and when it was set, with `total` and a `cursor` while more remain. A member's fields are bounded (name 80, job title 60, bio 200, priority 500 characters of text), so a page stays under 40000 characters and a team of any size reaches the model whole, in pages; the description tells it to follow the cursor whenever it needs everyone | M16 |
| `read_log` | `{ from, to, memberId?, cursor? }`, at most 31 days: entries as text, with author and date, newest first, up to 40000 characters, with a `cursor` when more remain. The backend reads 50 entries at a time, ordered by date then id, and stops reading once the budget is spent, so a busy month never loads in full. The cursor is an entry, and a block and an offset within it, as `read_knowledge`'s is, since an entry can hold 50000 characters (`MAX_LOG_ENTRY_LENGTH`): a page ends between entries when it can, between blocks inside an entry past the budget, and inside a block only when one block alone passes it, and a page that continues an entry says so | M16 |
| `set_top_priority` | `{ text }`: replaces the member's own top priority, Markdown stored as rich text, within the Today page's two limits: `MAX_TOP_PRIORITY_TEXT_LENGTH` (500) characters of text and `MAX_TOP_PRIORITY_LENGTH` serialized. Records the day's activity, as every change to Today data does | M16 |
| `ask_user` | `{ prompt, options (2 to 6), multiple }`: ends the run until the member answers. The prompt holds at most 1000 characters and each option 200 (`MAX_QUESTION_PROMPT_LENGTH`, `MAX_QUESTION_OPTION_LENGTH`), checked before anything is drawn: a call past either is refused with a result saying so, and nothing reaches the thread, so a question stays within the live tail's bound | M11 |
| `list_integrations` | The organization's servers, whether each works for this member, and their tools' names and descriptions | M23 |
| `describe_integration_tool` | `{ integration, tool }`: the tool's input schema | M23 |
| `call_integration_tool` | `{ integration, tool, arguments }`: calls it as this member, after their approval unless an administrator allowed the tool to run without it | M23 |

- Each tool's description says when to call it, which is what Opus reads to decide.
- A result goes back as JSON, cut to 50000 characters with a note saying so. A failure goes back
  as `is_error: true` with a sentence the model can act on.
- The thread labels each tool from the `conversation` catalogue, running and done: "Searching
  knowledge" and "Searched knowledge", "Opening knowledge" and "Opened knowledge", "Creating
  knowledge", "Updating knowledge", "Reading your team", "Reading the log", "Setting your top
  priority" and "Searching the web".
- Integrations go through three fixed tools rather than one tool per server tool, so the tools list
  never changes with what an organization connects, which keeps the transcript valid and the cache
  warm.
- Each milestone that adds tools changes the tools list for existing conversations: `drop_block`
  makes that a one-time loss of their earlier reasoning, nothing more.

### Rich text and Markdown

Documents, top priorities and log entries are stored as BlockNote blocks (paragraphs, headings 1 to
3, quotes, bulleted, numbered and check list items, bold, italic, underline, strikethrough, web and
mail links); the agent reads and writes Markdown. The stored model lives in the design system's
`lib/` (`richText.ts`'s types, `normalizeRichText`, `parseRichText`, `getRichTextText`), beside
the conversions between blocks and a document's shared text (`createRichTextYUpdate`,
`readRichTextYDoc`), which go through a headless BlockNote editor and so need `@blocknote/core`
and `yjs`. strategydance-core has no runtime dependency and keeps none, so the model does not move
there: the backend imports those `lib/` modules from the design system instead, which import
neither React nor the DOM, and whose tests already run them under Bun. M13 adds a pure
`richTextToMarkdown` and `markdownToRichText` there for exactly that subset: anything else becomes
paragraphs. Markdown has no underline, so the pair writes and reads it as `<u>…</u>`, the one tag
`markdownToRichText` understands; any other tag stays literal text, nothing is ever rendered as
HTML, and the system prompt says underline belongs in documents, never in replies. A document then
keeps all four styles through an agent's edit.

**A document's text is shared**, so the agent reads and writes it as an editor does (see
`CLAUDE.md` § The database):

- **Reading** merges the snapshot, `state`, with the pending `DocumentUpdate` rows into a Yjs
  document and reads its blocks with BlockNote's `yDocToBlocks`, ids and all, then each through
  `normalizeRichText` for its Markdown. Not through `readRichTextYDoc`, which normalizes the whole
  document and drops the ids that the tools' cursors and ranges name. `content` is only the last
  compaction's copy, and lags whenever somebody typed since. A document stored before the editor
  was shared has no `state` and so no ids: the first read seeds it, storing its snapshot under
  `SeedDocumentState`'s condition before it answers, and reads the snapshot that won when a tab
  seeded it first, so the ids it hands out are the ones every later read sees.
- **Writing** applies the edit to that Yjs document as a difference, never by building a new one:
  a document built from the edited blocks shares no history with the stored one, so merging it
  would add the text a second time. The edit works on the document's own blocks as BlockNote reads
  them (`yDocToBlocks`), ids included, rather than on the stored model, which has no ids: the blocks
  it replaces go, new ones come without an id and get a fresh one, and every other block keeps its
  id. The result becomes a ProseMirror node of the editor's schema, and y-prosemirror's
  `updateYFragment` writes only what differs into the shared fragment, so blocks the edit leaves
  alone keep their identity, and what a member types in them meanwhile merges.
- **Storing** is a fold, as a tab's compaction is: one backend mutation writes the new `state`,
  `content` and `contentText` under the `revision` it read, deletes the updates it merged, and
  records the call's result (see Recovery and side effects). A push that lands meanwhile is not
  among them and stays pending, and merges with the edit as two members' edits merge. A pushed
  update moves no revision, so for a whole-document `content` replacement, whose `version` says the
  model saw the text it replaces, the fold also checks, after it has locked the row, that no
  update is pending beyond those it merged, and reads again when one is. A push committing inside
  the fold's own transaction still merges rather than refuses, as concurrent edits do, which the
  version check never meant to prevent; a fold somebody else made meanwhile moves the revision, and the
  backend reads again and reapplies, three times at most. Every tab with the document open sees the
  revision move and reads the snapshot again, as after any fold, so the agent's edit appears in
  open editors without a reload. A fold has no 50000-character bound, as a pushed update has, so a
  large edit goes through whole. A document with no `state` is seeded in the same write, under
  `SeedDocumentState`'s condition.

The thread draws the agent's Markdown with a new design-system `Markdown` component (M3:
`react-markdown` and `remark-gfm`, no raw HTML, an element allowlist, and a `renderLink` prop for
`doc:` links).

### Release gate

Until M24, conversations exist for Strategy Dance administrators only. The gate hides an unfinished
feature; it protects no data, since a conversation is its owner's own. A staff member who loses the
role keeps reading the conversations they wrote, which exposes nothing of anybody else's, while the
backend's routes, checked on every action, stop them starting or continuing runs, and the
worker's claim checks the role again, so a queued run stops too:

- The sidebar item, the aspect page section and the dock show for `user.isAdministrator` only. The
  sidebar's `useConversationsAwaitingAnswer` runs for staff only and never behind a waiter.
- The routes sit behind a release bouncer that redirects anybody else to `/today`, as
  `AdministrationBouncer` does, mounted once in the parent layout route `_app/conversations.tsx`
  around its `<Outlet />`, as `administration.tsx` mounts its bouncer, so the list, a conversation's
  page and any page added under `/conversations/` later are all behind it.
- The backend's conversation routes run `staffOnlyMiddleware`, and so do the integration routes of
  M21 and M22, the OAuth initiation included: an authorization's state only exists once a staff
  member started it, so the callback is gated through it. The integration list query filters on the
  caller being staff until M24.
- The web connector's conversation operations need no gate of their own: a conversation only comes
  into being through the backend's gated routes, so a caller who skips the interface reads and
  changes nothing.
- All of it keys off `ARE_CONVERSATIONS_STAFF_ONLY` in strategydance-core, which M24 removes.
  Locally, `bun run grant:administrator <email>` makes an account staff.

### Google Cloud setup

Done once by a human. Steps 1, 2, 5 and 8 come before M1, whose spike is the first request to
Vertex; the rest before the milestone each names (development otherwise uses the developer's ADC
and in-process runs):

1. Enable Claude Opus 5.5, and Claude Opus 5 for the refusal fallback, for project `strategydance`
   in Agent Platform's Model Garden (accept Anthropic's terms), and check the quota for
   `claude-opus-5-5` on `global`. Raise it before M24.
2. `gcloud services enable aiplatform.googleapis.com cloudtasks.googleapis.com
   cloudscheduler.googleapis.com --project strategydance`, and allow web search for partner models
   in the organization policy (`constraints/vertexai.allowedPartnerModelFeatures`, which leaves
   `web-search` off by default), an organization administrator's change, or every request carrying
   the tool fails.
3. For M8: grant the runtime service account (the Compute Engine default one, see `CLAUDE.md`),
   which both services run as, `roles/aiplatform.user`, `roles/cloudtasks.enqueuer` and
   `roles/cloudtasks.viewer` (the queued-run check reads tasks, which the enqueuer role does not
   allow). Create `conversation-tasks@strategydance.iam.gserviceaccount.com`, the identity Cloud
   Tasks and Cloud Scheduler call the worker as, grant it `roles/run.invoker` on the project, which
   can be done before the worker exists and reaches no other private service, since the worker is
   the only one, and grant the runtime account `roles/iam.serviceAccountUser` on it, which creating
   a task that carries its token needs. If
   dispatches fail on the token, also grant the Cloud Tasks service agent
   `roles/iam.serviceAccountTokenCreator` on it.
4. For M8: `gcloud tasks queues create conversation-runs --location us-central1 --max-attempts 5
   --min-backoff 90s --max-concurrent-dispatches 50 --project strategydance`.
5. Developers: `gcloud auth application-default login` as an account with `roles/aiplatform.user`, so
   `bun run dev:backend` reaches Vertex. Development calls the real model and costs money.
6. For M8, once its release has deployed the worker, whose address the job names: a Cloud Scheduler
   job calling the worker's `POST /internal/sweep` daily with an OIDC token for
   `conversation-tasks` (`gcloud scheduler jobs create http`), its `--oidc-token-audience` the
   worker's base `run.app` address without the path, which is what Cloud Run checks the token
   against.
7. For M19: the bucket's lifecycle rule deleting objects under `pending/` older than two days
   (`gcloud storage buckets update gs://strategydance.firebasestorage.app --lifecycle-file=…`).
8. A budget alert on Vertex spend, since nothing caps usage yet, and staff runs in production and
   every development run cost money from the first request.
9. For M21 to M23: a Cloud KMS key for integration secrets, with
   `roles/cloudkms.cryptoKeyEncrypterDecrypter` for the runtime service account.

### Cost

At first-party list prices ($4 per million input tokens, $20 per million output, cache reads $0.20,
cache writes $5; check Vertex's partner prices) and medium effort, a run of three requests over a
cached 15000-token conversation, writing 2000 tokens each, costs about $0.15, plus about $0.01 per
web search. A member running ten a day costs about $1.50 a day, two orders of magnitude more than
the rest of the bill per user (`operations-costs.md`). Usage is recorded per run from M9, and M24
adds a section on it to `operations-costs.md`.

That figure assumes the cache holds between requests, which it does within a run. Between a
member's messages it holds only for five minutes, the default lifetime: a reply sent after a longer
pause writes the whole conversation to the cache again, at $5 a million, which for a 100000-token
conversation is $0.50 a message. A one-hour lifetime on the conversation's breakpoint costs $8 a
million to write and survives a coffee break. M9 records cache reads and writes per request, and
the lifetime is chosen from what members' pauses turn out to be.

## Risks and open questions

- **Spend**: nothing caps usage until credits exist; the budget alert is the guard.
- **Vertex**: partner pricing, the web search price, the request size limit and the quota for
  `claude-opus-5-5` on `global` need checking in the console.
- **Deploys during a run**: Cloud Run should let a running request finish when a revision replaces
  its instance; if not, the lease and Cloud Tasks' retry resume the run.
- **Live query traffic**: progress lines and leases refresh only `GetConversationRun`; each message
  refreshes the open thread's tail of 150 entries and the dock's few rows; the list of 1000 and the
  aspect page's cards rerun only when a run starts or ends, and the badge only when a run starts or
  stops waiting.
  The tail carries no bodies, about 45 KB at most, and each body is read once by id, so a run of
  100 entries sends an open reader a few megabytes of refreshes at most, not hundreds.
- **Editing the shared text from the backend**: nothing in the repository does it yet. BlockNote's
  helpers build a document from blocks rather than diff one, and a diff written wrong duplicates or
  loses a member's text in every open tab. M1's spike proves `updateYFragment` with the editor's
  schema under Bun, against a concurrent edit, before M13 and M14 depend on it; if it fails, the
  agent creates documents only and suggests edits to existing ones in its reply until a way is
  found.
- **Processing location**: Vertex's `global` endpoint may process a request in any region. The
  legal review before M24 says so, and names Google and Anthropic as processors of what members
  write and attach.
- **Prompt injection**: knowledge, the log, the web, files and integrations carry text others wrote,
  and a system prompt is no boundary; what the tools allow is. Integration calls wait for the
  member's approval, except auto-approved tools, which anything the agent reads can get called at
  once (allowing one is an administrator's acceptance of that), and every integration request
  passes the outbound guard.
- **Built-in writes run without approval, by David's decision**, as the design shows, so injected
  text could get the agent to change an unlocked document or the member's priority. The AI lock, the
  tool call row each write leaves in the thread, and the version check limit it; if that proves too
  loose, M23's approval entry can gate built-in writes too.
- **Long conversations**: 1M tokens of context is far off; compaction and context editing are
  available (beta on Vertex) if it comes to that.
