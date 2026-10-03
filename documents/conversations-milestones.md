# Conversations: the milestones

The twenty-two milestones that build the conversations feature, each one pull request into `dev` that a
Claude Code session can implement, with the conventions every one of them follows. What they build,
and why, is in [conversations.md](conversations.md): the sections named here, such as The data, A
run, The transcript, The agent and Tools, are that document's. When a milestone merges, write its
pull request number in the table below.

## Conventions for every milestone

- Follow `CLAUDE.md`: a branch from `origin/dev`, granular commits each green on lint, typecheck,
  test and build, a pull request into `dev`, the Copilot loop, then a human merges.
- Read the Architecture of [conversations.md](conversations.md) first. Load the `claude-api` skill before writing any Claude
  SDK code, and never guess an SDK name.
- Strings go in the `conversation` catalogue (`integration` for the MCP pages), registered app-wide
  in `_app.tsx`'s `APP_MESSAGE_TYPES` since the dock and the sidebar need it everywhere, and
  `bun run translate` runs whenever one changes. No em dash in a message.
- Web files: `components/conversation/`, `hooks/conversation/`, `utils/conversation/`,
  `contexts/ConversationDockContext.ts`. One concern per file, a waiter above the bouncer that reads
  its data, waiters keyed on the organization's id, no `useMemo` or `useCallback`.
- Backend files: `routes/conversations.ts` (mounted at `/organizations/:organizationId/conversations`
  with `mergeParams`), `routes/internal.ts`, `middleware/organizationMember.ts`,
  `middleware/staffOnly.ts`, `middleware/cloudTasks.ts`, `middleware/conversationSearchRateLimit.ts`, `domain/conversations/`, `domain/agent/`.
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
| M3 | Navigation, the list, search and delete, from seeded data | web, backend, database, root | |
| M4 | The conversation page and its thread, read-only | web | |
| M5 | Runs without a model, in the backend's process | backend, database, root | |
| M6 | The composer and drafts | web | |
| M7 | Runs through Cloud Tasks, and the daily sweeper | backend, database, root | |
| M8 | Claude replies, with web search | backend, database, web | |
| M9 | Stop, resume, retry, failures and refusals | backend, database, web | |
| M10 | Rich text and Markdown in core | core, design-system, web | |
| M11 | Knowledge tools and knowledge links | backend, database, web | |
| M12 | Mentioning knowledge in the composer | web | |
| M13 | Team, log and top priority tools | backend, database, web | |
| M14 | Questions | backend, database, web | |
| M15 | Aspect tagging, suggestions and the aspect page section | backend, database, core, web | |
| M16 | The dock | web | |
| M17 | Attachments: storing them and sending them to Claude | backend, database, root | |
| M18 | Attachments in the composer and the thread | web | |
| M19 | Integrations: the organization's servers | database, backend, web | |
| M20 | Integrations: members connect their accounts | database, backend, web | |
| M21 | Integrations in conversations | database, backend, web | |
| M22 | Launch | all | |

### M1: The conversation tables and the web's operations

The data model and the web connector's operations, with nothing yet using them.

- The five tables and their enums, as The data describes, commented in `schema.gql`'s style, with
  `@searchable(language: "simple")` on `Conversation.title` and `ConversationMessage.text` (check
  that the emulator takes `simple`, and fall back to `english` otherwise); Chinese and Japanese go
  through the substring path conversations.md describes, since no text search configuration splits
  them. All additive, so the release migrates by itself.
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
- `_app/conversations.tsx`, the parent layout route holding the release bouncer around its
  `<Outlet />`, as `administration.tsx` holds `AdministrationBouncer`, so every page under
  `/conversations/` is gated by it. Under it, `_app/conversations.index.tsx`, its waiter keyed on the organization's
  id, `useConversations` copying `useOrganizationTeam`'s live pattern (`retryOnMount: false`,
  `hasFailed`).
- The list: header (New conversation arrives in M6), search (debounced, through the backend's
  search route, which lands here with the conversations router, its member and staff middleware,
  its backend-connector search operations, and the `ConversationSearch` table its shared quota
  counts, additive), table, previews worded from `preview`, empty states,
  Delete with confirm and Undo through `DeleteConversation` and `RestoreConversation`.
- Tests: wording a preview; the search route merging titles and messages, deduplicating by
  conversation, and stopping at 1000 conversations or ten pages; a Chinese and a Japanese query
  taking the substring path, which reads at most 20000 messages, newest conversations first; a query
  past 100 characters or 8 terms refused; the 121st search from one caller in ten minutes refused by
  the in-memory limiter and, with a fresh limiter as another instance would have, by the shared
  count (database mocked).
- Verify: seed, then the list at desktop and phone widths against the design; search; delete and
  undo; a non-staff account sees no item and is redirected.

### M4: The conversation page and its thread, read-only

- `_app/conversations.$conversationId.tsx`, under M3's layout route and so behind its release
  bouncer: search param `isNew` validated (`aspect` in M15), and
  `beforeLoad` refusing an id that is not one, as `knowledge.$documentId.tsx` does; a
  `ConversationOrganizationBouncer` copied from `KnowledgeOrganizationBouncer`, back to the list when
  the organization changes; waiters keyed on the organization's id; `useConversation` and
  `useConversationRun`.
- The page: the bar, the title, the aspects button (on saved conversations: a draft's aspects arrive
  in M15, sent with its first message); `KnowledgeDocumentAspectsDialog` generalized into an
  `AspectsDialog` taking its labels as props; `UpdateConversationAspects`.
- The thread drawing every kind of entry, read-only: text through `Markdown`, tool calls and their
  output dialog (`GetConversationToolCall`), questions in their answered and skipped states (waiting
  ones drawn disabled until M14), notes, aspects notes, the thinking indicator from the run with its
  own one-second timer (`useNow` ticks once a minute), and the missing conversation's state.
- The live tail and the older pages (`GetConversationMessagesBefore`) loaded as the reader scrolls
  up, merged into one thread.
- `MarkConversationRead` when the page shows a conversation with unread replies.
- Verify: the seeded conversations against the design at both widths; switching organization on a
  conversation's page goes back to the list; a non-staff account sent to a conversation's address
  is redirected to `/today`.

### M5: Runs without a model, in the backend's process

The send route and the whole run lifecycle, answered by a placeholder agent, in the backend's own
process. No queue and no composer yet: a script sends, and the page from M4 shows the reply arrive.

- `POST …/messages`, body `{ messageId, text }` for now (later milestones add a draft's aspects,
  suggestion and attachments), validated on the server: `text` trimmed, not empty (M17 allows that
  with files), at most `MAX_CONVERSATION_MESSAGE_LENGTH`, or a 400. The first message creates the
  conversation (title rule, `MAX_CONVERSATIONS` under the membership lock, pruning what the member
  deleted over a day ago) with its message, queued run and first transcript entry, in one mutation;
  a later one locks the conversation and needs room for a run; both hold
  `MAX_ACTIVE_RUNS_PER_MEMBER` and finalize a dead run; then the run goes to `enqueueRun`: 202 with
  the run's id. Idempotent on the client-made `messageId`: a retry completes what is missing and
  answers with the same run.
- `enqueueRun` starts `runConversation` in the process without waiting, as development keeps doing
  for good. Until M7 brings the queue, the route refuses in production with a 503 before writing
  anything, since a run left going after the response would stall once Cloud Run throttles the CPU.
- `runConversation`: claiming, leases, fencing, finishing, drawing with its cursor and deterministic
  ids, and a placeholder agent that writes one `AGENT_TEXT` through the code paths M8 uses.
  `POST …/runs/:runId/reconcile`, which the page calls for a queued run past its lease, finalizing it
  as interrupted (M7 has it ask Cloud Tasks first). The backend operations for all of it.
- A script under `scripts/` signs in to the Auth emulator and sends through the route, which is how
  this milestone is driven before the composer.
- Tests (database mocked): claiming twice, an expired lease, fencing, finishing only the active run,
  busy, a dead run finalized, a send retried with the same `messageId`, a fourth run refused, a
  conversation without room for a run refused, an empty, a blank and an over-long message refused.
  Against the emulators, a script under `scripts/` sends from two conversations at once with two
  runs already in flight, and exactly one goes through.
- Verify: locally, send with the script while the conversation's page is open in two tabs, and watch
  the reply arrive in both; restart the backend mid-run, see the run shown interrupted a minute
  later, and send again.

### M6: The composer and drafts

- The composer, text only: send, Enter and Shift+Enter, nothing sent while an input method is
  composing, disabled while a run goes; a send that fails keeps its text and is retried with the
  same `messageId`. Drafts: "New conversation" opens `/conversations/<createId()>?isNew=true`, the
  first send creates it, then `isNew` leaves the address as knowledge's does.
- Verify: locally, start a conversation with "New conversation", send in two tabs and watch the
  reply arrive; stop the backend, send, and see the text kept, then sent once it is back.
  Production refuses sends until M7.

### M7: Runs through Cloud Tasks, and the daily sweeper

Google Cloud calling the backend: Cloud Tasks for each run, Cloud Scheduler for the daily sweep, both
with an OIDC token. Sends work in production from here.

- Dependencies: `@google-cloud/tasks` (the same google-gax stack `@google-cloud/secret-manager`
  already runs under Bun) and `google-auth-library`, declared directly since Bun's isolated install
  does not expose firebase-admin's copy.
- The `cloudTasks` middleware (the conversations router and the member and staff middleware arrived
  with M3's search), verifying the OIDC token's audience (`PRODUCTION_API_URL` +
  `/internal/conversation-runs`) and its service account, both backend constants, since Cloud Run
  tells the service neither.
- `enqueueRun` in production: a named task (`run-<runId>`, so a repeat does not queue twice), an OIDC
  token, a 15-minute dispatch deadline, and the queueing failures A run describes; development keeps
  running in the process. `POST /internal/conversation-runs` runs `runConversation`, with its 200 and
  503 answers. The reconcile route asks Cloud Tasks about a queued run's task, pushing its lease back
  while the task exists and finalizing the run once it is gone.
- **The daily sweeper**: `POST /internal/sweep`, called once a day by Cloud Scheduler with an OIDC
  token (the shared verifier takes each endpoint's own URL as its audience, Cloud Scheduler's
  default), removes what is still deleted past its Undo window
  whether or not anybody comes back: conversations deleted over a day ago, with their attachment
  rows and Storage folders, and `ConversationSearch` rows over a day old; later milestones add
  stale upload reservations and unsent files (M17)
  and deleted integrations with their credentials (M19). The prunes done on the way through stay as a
  fast path; every step is idempotent.
- `deploy:backend` gains `--timeout 900`. The welcome email's lease goes from ten minutes to twenty
  (`ClaimWelcomeEmail` and its comment in the backend connector, the `schema.gql` comment,
  `sendWelcomeEmail.ts`), since a request may now run fifteen.
- Tests (database mocked): a token for another audience or service account refused; an unclear and
  a definite queueing failure, both leaving the run queued for the retry to enqueue; the worker's 200
  once its run is finished and 503 while another holds the lease; the reconcile route keeping a
  queued run whose task exists and finalizing one whose task is gone; the sweeper claiming a
  conversation before deleting it, a restore refused once it is claimed, and a prune that failed
  after claiming finished by the next sweep.
- Verify: setup steps 2 to 4 and 6 before the release; then, as staff in production, send and watch
  the task in Cloud Tasks' logs and the reply arrive, and the sweeper's first run in Cloud
  Scheduler's.

### M8: Claude replies, with web search

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
  offsets kept right; a reply past 20000 characters drawn as pieces split between blocks, a single
  long block split at a line break, citations rebased to their piece, one unread count, and a
  crash between two pieces drawing the rest once; a web search becomes one finished call; usage
  adds up.
- Verify: setup step 1 and, for development, step 5; ask a question that needs the web and one that
  does not; watch progress lines; check the logs show `input_transformations` empty across turns.

### M9: Stop, resume, retry, failures and refusals

- Routes `…/stop`, `…/resume`, `…/retry`, as The transcript describes, finalizing dead runs.
- The worker: aborting on the stop flag, cancelled calls, notes; failures (`FAILED`, the reason in
  `failure`, a note) after the SDK's retries, at the step and time limits, and on `max_tokens`;
  refusals and their fallback, as The agent describes.
- The composer's Stop button; the notes with Resume and Retry as the design offers them; a run past
  its lease shown as interrupted.
- Tests: a stop mid-stream drops the turn and stores no context message; resume runs the unanswered
  `tool_use` blocks; retry goes back to the run's anchor, for a files-only message and for an
  answer, and its cut passes `checkTranscript`; retrying many times lowers `messageCount` by what it
  deletes, so it never fills the conversation, and so does stopping and resuming many times;
  Resume hidden, and refused, when removing the note would leave less than a run's room, while
  Retry still frees it; sending after a stop answers the open blocks; a turn
  with a `fallback` block is stored without the blocks before its boundary.
- Verify: stop during a web search, resume, retry; kill the local backend mid-run and resume after.

### M10: Rich text and Markdown in core

A refactor and two pure functions, no visible change.

- Move the stored rich text model into `strategydance-core/src/helpers/richText/`; the design system
  keeps its class names, gains `strategydance-core` as a workspace dependency and imports the rest
  from it; re-point the web's imports.
- `richTextToMarkdown(blocks)` and `markdownToRichText(markdown)` for the subset, with tests: round
  trips of all four styles, underline through `<u>…</u>` included, alone and nested in the others;
  another tag kept as literal text; nesting, check items, links, what degrades to paragraphs,
  lengths against `MAX_DOCUMENT_CONTENT_LENGTH`.
- Verify: the four checks; knowledge, the log, priorities and build in public cards draw as before.

### M11: Knowledge tools and knowledge links

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
  - Both the backfill and the on-demand reindex write `contentText` only where the document's
    `revision` is still the one they read, so an edit that lands in between, which nulls
    `contentText` again, is never overwritten with text from the content before it; a conflict stays
    null for the next pass. Tests cover an edit landing between the read and the write.
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
  old operations nulling `contentText`, and the next search reindexing it; a Chinese and a Japanese
  search finding a word inside a document's sentence, reading the content of the 100 latest
  documents at most; Markdown in, the document
  draws as written.
- Verify: ask the agent to write a decision into an existing document, then to create one; open them
  in Knowledge; lock one and ask again.

### M12: Mentioning knowledge in the composer

- The "+" menu (with "Mention knowledge" only until M18), the `@` list and its keyboard handling,
  mentions sent as `[Title](doc:<id>)`, all as The composer describes.
- Verify: mention two documents, send, see the links in the bubble and the agent read them.

### M13: Team, log and top priority tools

- Backend-connector operations reading the team (as `GetOrganizationTeam` does, without emails) and
  the log for a range, both checking membership; `get_team` and `read_log`, priorities and entries
  converted with `richTextToMarkdown`, both paged with a cursor as Tools describes.
- Tests: a team of 60 read in three pages with `total` right; a single 50000-character log entry
  read across pages that join back whole, and one made of a single 50000-character paragraph too;
  a page continuing an entry saying so.
- The three tools' labels in the `conversation` catalogue, running and done ("Reading your team",
  "Reading the log", "Setting your top priority"), and `bun run translate`.
- `set_top_priority`, through one backend mutation `SetTopPriorityForAgent($organizationId,
  $userId, $topPriority, $date)`: it checks membership, writes the member's own `topPriority`
  (through `markdownToRichText`, held to the Today page's two limits, `MAX_TOP_PRIORITY_TEXT_LENGTH`
  of text and `MAX_TOP_PRIORITY_LENGTH` serialized) and `topPriorityUpdatedAt`, and upserts their
  `activityDay` row, as `CLAUDE.md` asks of every change to Today data, with `RecordActivity`'s check
  that `$date`, computed from the member's time zone, is their today. Its `$organizationId` matches
  `GetOrganizationTeam`'s refresh, so an open Today page updates at once.
- Verify: "What is everybody working on?", "What did I log this week?", and "Make shipping the
  pricing page my priority": the Today page updates without a reload, and the build in public streak
  counts the day once the page is reloaded (`GetActivityDays` is not live).

### M14: Questions

- `ask_user`, its `QUESTION` messages, `WAITING` runs with their `pendingToolResults`, and the
  "Asking you" label of a question refused at the cap.
- `POST …/answers` with `{ messageId, selected, other }`, serialized on the waiting run as The
  transcript describes, and skipping on send. The answer is checked against its stored question
  before anything is recorded, since it goes into Claude's transcript: `selected` holds distinct
  options of that question only, at most one for a single-choice question; `other` is one trimmed
  line of at most 500 characters (`MAX_ANSWER_OTHER_LENGTH`); an answer chooses at least one option
  or writes something; and a single-choice answer is exactly one of the two, an option or its own
  words, as the radios draw it.
- The question's waiting state in the thread, "Needs your answer" in the list and on cards, the
  sidebar badge, and questions in previews.
- Tests: an `ask_user` call whose prompt or one option is a character past its bound refused before
  anything is drawn, and one at the bounds drawn; an unknown, repeated or second option for a
  single-choice question refused, an empty answer refused, a long `other` refused, an option and own words together on a single-choice
  question refused; two questions in one turn wait for both answers, and two answers sent at once start exactly
  one run; the preview following an answer to the last question shown, and staying put for an
  answer to an earlier one; a skipped question's result; the other tools' results go back with the answers, in
  order; a backend stopping between the last answer and its continuation, finished by the answer
  sent again and by the reconcile route; at the cap, a turn whose question would leave less than a
  run's room and one more has it refused, drawn as a failed call, and the run goes on, while one
  leaving exactly that much waits, and both its answer and a typed skip start a run; a member with
  three runs in flight answering, the continuation starting once one ends.
- Verify: ask the agent to help choose a price, answer with an option and your own words, then skip
  one by typing.

### M15: Aspect tagging, suggestions and the aspect page section

- The tagging side request and its note, as The agent describes.
- The suggestion catalogue: `CONVERSATION_SUGGESTION_IDS` in core (keys like
  `STRATEGY_ONE_METRIC`), the 36 titles and openers in the `conversation` catalogue.
- The conversation route's `aspect` and `suggestion` search params, validated; the aspects button on
  a draft, held in the draft until it is sent; the first message's draft fields (`aspects`,
  `suggestionId`, `title`, `opener`); the opener inserted in the first send's one mutation, at
  position 0 before the member's message, so the first send stays atomic and a retry finds it whole;
  in the transcript, the suggestion carried in the first user entry, never as an assistant entry
  (see The agent).
- The aspect page's Conversations section above Knowledge, as designed, and "New conversation"
  tagged with the aspect.
- Verify: a new conversation about pricing gets tagged; set aspects before sending and it does not;
  start a suggestion and see it leave the cards.

### M16: The dock

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

### M17: Attachments: storing them and sending them to Claude

- The upload's transport: `PUT /organizations/:organizationId/conversations/:conversationId/attachments/:attachmentId`,
  the conversation's id in the path (a draft's, made by the browser, before the conversation
  exists), the raw bytes as the body with their `Content-Type`, and the file's name in an
  `X-File-Name` header, URL-encoded, one line of at most 200 characters, all validated before the
  reservation.
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
  finishing its reservation; a retry refused once a prune has claimed its row, and a prune never
  deleting the object of a row that became `READY`; two sent at once with one id ending with one
  row; a placeholder replayed byte for byte; a conversation marked full.
- Verify: with a script, upload an image, a PDF and a text file, send them, read the reply.

### M18: Attachments in the composer and the thread

- The "+" menu's "Files and images", paste, the tray with upload progress, image shrinking, the
  budget's message; the thread's thumbnails fetched from `GET …/attachments/:attachmentId` with the
  caller's tokens and shown as object URLs, file chips, the image dialog.
- Verify: attach each type from the composer and ask about it; reach the conversation's budget.

### M19: Integrations: the organization's servers

- `OrganizationIntegration`: name, `https` URL, catalogue slug, authentication (`OAUTH`, `API_KEY`
  or `NONE`), `isEnabled`, `configRevision` (see below), the key encrypted with Cloud KMS and its last four characters, the OAuth
  client it registered, its tools as last listed (annotations included), `autoApprovedTools` (tools
  an administrator lets run without approval, each bound to a hash of the definition reviewed:
  name, description, input schema, annotations; a refresh that changes a definition clears its
  approval), `lastError`, `lastUsedAt`, `deletedAt`. The live list never selects a secret, and says
  its limit (`MAX_INTEGRATIONS`, 50 per organization).
- **The address, the authentication and the authorization server are bound to the credentials.**
  The integration keeps the issuer it validated; changing the address or the authentication, or a
  discovery that resolves a different issuer, clears in one mutation everything issued for the old
  ones (the key, the registered client, members' connections, pending authorizations, and every
  auto-approval, since a different server could advertise identical definitions), and members
  reconnect, so no credential or approval reaches a server it was not given for. The same mutation
  bumps the integration's `configRevision`, a counter M21's pending approvals are bound to.
- The server dialog lists its tools with a switch each for running without approval. A tool's
  `readOnlyHint` is shown beside it as the server's own claim, which may suggest a choice, never make
  one: the MCP specification calls annotations untrusted.
- Backend routes for administrators: add (connects with `@modelcontextprotocol/sdk` over Streamable
  HTTP and lists the tools), edit, delete, turn on and off, retry. Deleting sets `deletedAt`, keeping
  the secrets for Undo; the daily sweeper (M7) removes it a day later, with its connections, pending
  authorizations and encrypted credentials, if it is still deleted.
  Encryption through Cloud KMS, and a local key in development.
- **Every request to a server's address goes through an outbound guard**, since an administrator
  types it: `https` only; every address the host resolves to must be globally routable unicast, an
  allowlist, so loopback, private, link-local, carrier-grade NAT, multicast, unspecified (`0.0.0.0`,
  `::`), other special-use ranges and the metadata server (`169.254.169.254`,
  `metadata.google.internal`, which hands out the service account's tokens) are refused; the
  connection goes to the address checked, and the check repeats on every redirect; timeouts and a
  response size cap. A request carrying a credential (an API key, a token, a client secret) never
  follows a cross-origin redirect; only unauthenticated discovery follows redirects, each hop
  guarded. OAuth discovery and token requests (M20) use the same guard.
- The guard ships with deterministic tests, a fake resolver and transport standing in for the
  network: representative IPv4 and IPv6 addresses of each special-use range (private, loopback,
  link-local, unique local, carrier-grade NAT, multicast, documentation, `0.0.0.0` and `::`),
  IPv4-mapped IPv6 forms, the metadata names, a public address allowed, a resolver whose answer changes between the check and the
  connection, a redirect to a blocked address, a timeout, and a response past the size cap.
- The Integrations page as designed (table, server dialog, gallery with marks in
  `public/assets/images/mcp/`), staff gated, and its sidebar item. Check each catalogue address is a
  real remote MCP server before shipping it.
- Verify: add a key-based server and an OAuth one, turn one off, delete and undo.

### M20: Integrations: members connect their accounts

- `IntegrationConnection`, one per member and server: the account's label, tokens encrypted, expiry,
  status. Pending authorizations: references to the initiating member and integration (all the
  unauthenticated callback has is `code` and `state`), a unique, random 256-bit `state`, the PKCE
  verifier encrypted, an expiry. The callback consumes the authorization first, deleting it by
  `state` under `@check(this == 1)`, before exchanging the code, so a replayed or concurrent callback
  finds nothing and writes nothing. Starting a Connect replaces the member's earlier pending
  authorization for that server, and the daily sweeper deletes expired ones.
- A token refresh is serialized per connection: a refresh first takes a short lease on the
  connection's row (`refreshingUntil`, set only where it has lapsed), writes the new tokens in one
  update, and releases it; a call that finds the lease taken waits briefly and reads the refreshed
  tokens, so concurrent runs never spend a rotating refresh token twice.
- The OAuth flow MCP servers expect: discovery from the server's protected resource metadata;
  client registration in the specification's order, a Client ID Metadata Document first (Strategy
  Dance hosts its client metadata at an `https` URL that serves as its client id) and dynamic client
  registration only as the fallback; authorization code with PKCE and the `resource` parameter; the
  callback at `https://api.strategydance.com/integrations/oauth/callback` redirecting to a web page
  that closes the popup, refresh before expiry, disconnect.
- The page shows each OAuth server's status for the viewer, with Connect and Disconnect for
  themselves, and the design's waiting dialog.
- Verify: connect two members to the same server as different accounts; disconnect one.

### M21: Integrations in conversations

- The three integration tools; calls with the member's own connection or the organization's key,
  30 seconds each; `lastUsedAt`; a 401 marks the connection as needing authentication.
- **The schema change**, additive, with `APPROVAL` appended to the kinds: `ConversationMessage` gains
  `integration` (an optional reference, nulled if the server is pruned), `integrationName` (at call
  time), `integrationToolName`, `approvalState` (`PENDING`, `ALLOWED`, `DENIED`), `approvalConfigRevision`
  and `approvalToolHash` (see below), and
  `argumentsPreview` (display text, cut to 2000 characters), which the live tail selects; the
  warning strip matches the live integrations list by `integration`, never by name. A preview
  authorizes nothing, since what matters can sit past its cut: Allow opens a dialog showing the
  complete stored `toolInput` (`GetConversationToolCall` reads a pending call too), whose own Allow
  approves; arguments past 100000 characters are refused before an approval is drawn.
- **Approval.** Every integration call waits for the member unless its tool is in the server's
  `autoApprovedTools`: the run ends `WAITING` on an approval entry (a new `APPROVAL` kind) showing the
  server, the tool and its arguments, with Allow (the call runs in the next run) and Deny (answered
  as refused), answered as questions are. Annotations decide nothing: a server can mislabel a tool
  that writes, and a read can carry private text out in its arguments. Injected text can then
  propose an action, never take one, except through an auto-approved tool, which it can get called
  at once with any arguments: the switch says so, and administrators allow only tools whose effects
  and reach they accept from anything the agent reads. At the cap, an approval that would leave
  less than a run's room and one more is refused as a question is (see A run), tested at the same
  boundary, answered and skipped by a send.
- **An approval is bound to the server and the tool it showed.** The entry records the integration's
  `configRevision` and the hash of the tool's definition (as `autoApprovedTools` hashes it) when it
  is drawn. Allow checks both against the integration as it is, and so does the continuation right
  before the call, so a change of address, authentication or issuer, or a refresh that changes the
  tool, never lets an approval given for one server run against another: on a mismatch the approval
  is marked denied and the call answered as refused, saying the integration changed since it was
  proposed, so the model can propose it again. Tested at Allow and at the call, for an address
  change and for a changed definition.
- **A waiting approval counts as a waiting question everywhere**: `GetConversations`' attention check
  also matches an `APPROVAL` whose `approvalState` is `PENDING` on a `WAITING` run, so it raises
  "Needs your answer", the sidebar badge and the minimized window's dot; inserting one adds to
  `unreadCount`; and its preview reads "Approval: Stripe · create_payment_link".
- **Sending while an approval waits denies it**: the new user entry first answers the pending call
  with "The member did not approve this call and wrote instead.", the approval is marked denied, and
  the send consumes the waiting turn under the same check as a question's, with the same
  answer-against-send race covered in the emulators.
- A call that started before a crash is never run again by itself (see A run).
- In the thread, integration calls show the server and the tool, and the warning strip when the
  server is missing, off, or not connected for the viewer, with what fixes it: administrators get
  "Add" or "Turn on", every member gets "Connect" for their own account, others read "Ask an
  administrator…". The Integrations page handles `?open=`, `?connect=`, `?enable=` and `?add=`.
- Verify: ask something that needs a connected server, then allow the call and deny another; let an
  administrator allow one tool and see it run straight away; turn the server off and ask again.

### M22: Launch

- Remove the release gate everywhere, and `ARE_CONVERSATIONS_STAFF_ONLY`.
- `CLAUDE.md`: a Conversations section with what a new tool needs, the transcript's rules and the
  run lifecycle, where earlier milestones have not written it.
- `operations-costs.md`: Vertex, Cloud Tasks and attachment storage, from the recorded usage.
- Before merging: the quota raised, the budget alert set, and the legal page reviewed for AI
  processing, which are David's calls.
