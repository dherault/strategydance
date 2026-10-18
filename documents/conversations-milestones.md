# Conversations: the milestones

The thirty-eight milestones that build the conversations feature, each one pull request into `dev`
that a Claude Code session can implement, with the conventions every one of them follows. What they
build, and why, is in [conversations.md](conversations.md): the sections named here, such as The
data, A run, The transcript, The agent, Tools and Modules, are that document's. When a milestone
merges, write its pull request number in the table below.

## Conventions for every milestone

- Follow `CLAUDE.md`: a branch from `origin/dev`, granular commits each green on lint, typecheck,
  test and build, a pull request into `dev`, the Copilot loop, then a human merges.
- Read the Architecture of [conversations.md](conversations.md) first. Load the `claude-api` skill
  before writing any Claude SDK code, and never guess an SDK name.
- Strings go in the `conversation` catalogue (`integration` for the MCP pages, `module` for the
  consent page, Connected agents and the modules' dialog), registered app-wide
  in `_app.tsx`'s `APP_MESSAGE_TYPES` since the dock and the sidebar need it everywhere, and
  `bun run translate` runs whenever one changes. No em dash in a message.
- Web files: `components/conversation/`, `hooks/conversation/`, `utils/conversation/`,
  `contexts/ConversationDockContext.ts`. One concern per file, a waiter above the bouncer that reads
  its data, waiters keyed on the organization's id, no `useMemo` or `useCallback`.
- Backend files: `routes/conversations.ts` (mounted at
  `/organizations/:organizationId/conversations` with `mergeParams`), `routes/internal.ts` (mounted
  by the worker service only), `middleware/organizationMember.ts`, `middleware/staffOnly.ts`,
  `middleware/conversationSearchRateLimit.ts`, `domain/conversations/`, `domain/agent/`; for the
  modules, `modules/` (one folder per module), `domain/knowledge/`, `domain/tasks/`, `domain/subagents/`,
  `routes/oauth.ts` (mounted at `/oauth`), `routes/modules.ts` (mounted at `/mcp`), `domain/oauth/`
  and `middleware/moduleRateLimit.ts`.
- Data Connect: a mutation writes each row once; messages are ordered by `position`, claimed on the
  conversation's counter; live queries name every mutation that changes them; backend operations
  take `$userId` and check it against the rows. Each milestone adds the tables, fields and
  operations it is the first to use, and a variable added to an existing operation later is
  optional, as `CLAUDE.md` § The database says, so no milestone has to guess another's needs and
  none breaks the connector.
- CI runs without emulators. Domain tests mock `strategydance-database/backend` with `mock.module`, as
  `deleteOrganization.test.ts` does; the SQL conditions are checked by hand against the emulators,
  with a script under `scripts/`, never a `*.test.ts`.
- A milestone that sets a convention later sessions must follow adds it to `CLAUDE.md` in the same
  pull request.
- Every milestone ends with the four checks green, and the UI ones with the change looked at in a
  browser, on desktop and phone widths, against the design.

## Milestones

A milestone starts once the ones it depends on have merged, so several can be under way at once:
M3 from the start, M13 as soon as M1 has merged, M15 and M18 as soon as M14 has, M30 as soon as M17
and M25 have, M35 and M36 as soon as M33 has, M37 once M35 and M36 have, and M12, M24 and M27 well
before their neighbours. M33 lets the agent launch, and only M34 has the page reconcile a parent's
subagents and Retry ask before it discards them, so M33 keeps `launch_subagent` refusing in
production behind a gate of its own, which M34 removes: a release cut between the two launches
nothing, rather than leave the daily sweep their only recovery.

| # | Milestone | Packages | Depends on | PR |
| --- | --- | --- | --- | --- |
| M1 | Spikes: the request to Claude, and an edit to a shared document | backend, design-system | Setup 1, 2, 5, 8 | #88 |
| M2 | The conversation tables | database, core | M1 | #95 |
| M3 | The Markdown component | design-system | | #94 |
| M4 | Navigation, the list and delete | web, backend, database, root | M2 | #102 |
| M5 | The conversation page and its thread, read-only | web, database | M3, M4 | #104 |
| M6 | Runs without a model, in the backend's process | backend, database, root, web | M5 | #105 |
| M7 | The composer and drafts | web | M6 | #111 |
| M8 | Runs through Cloud Tasks on the worker service, and the daily sweeper | backend, database, root | M6, setup 3, 4 | #113 |
| M9 | Claude replies, with web search | backend, database, web | M6; M8 to reach production | #120 |
| M10 | Stop, resume, retry, failures and refusals | backend, database, web | M7, M9 | #121 |
| M11 | Questions | backend, database, web | M10 | #122 |
| M12 | Searching conversations | backend, database, web | M8, M9 | #123 |
| M13 | Rich text, Markdown and shared documents on the backend | design-system, backend | M1 | #130 |
| M14 | The Knowledge module | database, core, backend, web, root | M12, M13 | #132 |
| M15 | The Tasks module | database, core, backend, web, root | M14 | #136 |
| M16 | Knowledge in conversations | backend, database, web | M10, M14 | #137 |
| M17 | Tasks in conversations | design-system, backend, web, root | M15, M16 | #139 |
| M18 | The authorization server | backend, database, core, root | M14, setup 10 | #141 |
| M19 | The consent page and Connected agents | web, backend, database, root | M15, M18 | #144 |
| M20 | The Knowledge module for external agents | backend, web, root | M19 | #146 |
| M21 | The Tasks module for external agents | backend, web, root | M15, M20 | #148 |
| M22 | Mentioning knowledge in the composer | web | M7, M16 | #140 |
| M23 | Aspect tagging | backend, database, web | M7, M9 | #143 |
| M24 | The dock | web | M7 | #145 |
| M25 | Attachments: storing them and sending them to Claude | backend, database, root | M8, M9, setup 7 | #149 |
| M26 | Attachments in the composer and the thread | web, database | M22, M25 | #151 |
| M27 | Integrations: the organization's servers | database, backend, web | M8, setup 9 | #157 |
| M28 | Integrations: members connect their accounts | database, backend, web | M27 | #165 |
| M29 | Integrations in conversations | database, backend, web | M11, M28 | #171 |
| M30 | Subagent conversations and their runs | database, core, backend, web, root | M17, M25 | #184 |
| M31 | Chains, slots and the subagents' queue | database, core, backend, web, root | M30, setup 11 | #193 |
| M32 | The Subagents module | core, backend, database, web | M31 | #196 |
| M33 | Subagents in conversations | backend, database, root | M11, M32 | #200 |
| M34 | Subagents in the thread | web, database, backend | M24, M26, M33 | #202 |
| M35 | Usage caps | core, database, backend, web, root | M33 | #207 |
| M36 | Integrations in subagents | backend, web | M29, M33 | #208 |
| M37 | Launch readiness | backend, database, design-system, web, root | M35, M36 | #210 |
| M38 | Launch | all | all | |

### M1: Spikes: the request to Claude, and an edit to a shared document

The plan rests on facts only a real request or a real merge can confirm, and the milestones after
this one build on them. Each is settled here, before any of them, and what it finds goes back into
[conversations.md](conversations.md): a check that fails changes the plan, with David, before M2
starts. M1 first probed Claude on Vertex; Google gave the project no Claude quota and refused one,
so the agent moved to Anthropic's API, as Decisions says.

- Dependencies: `@anthropic-ai/sdk` in the backend. Mind the seven-day install cooldown: a beta the
  SDK learned of last week cannot be installed yet.
- `packages/strategydance-backend/scripts/probeClaude.ts` (`bun run probe:claude`), against the API
  with the `anthropic-api-key` secret, exiting non-zero and naming every check that failed. Kept, so
  an SDK bump or a new model runs it again:
  - the request The agent describes, streamed: adaptive thinking with `display: "updates"` and
    `block_binding`, both betas, explicit effort, server-side fallbacks, a strict tool with eager
    input streaming, web search, top-level cache control, and the context message last as a
    mid-conversation system message, and the progress lines it gets, which the API does not
    promise (see The agent);
  - a second request replaying the first turn from its JSON text, with a `tool_use` whose input has
    keys out of alphabetical order: `input_transformations` comes back empty and
    `cache_read_input_tokens` is not zero; and a third replaying it with that input's keys
    reordered as `jsonb` would reorder them, to see whether the API counts that as an edit;
  - one PDF and one image counted from their bytes with `count_tokens`, which takes no Files API
    source, then uploaded through the Files API and read by a message by their ids, as the upload
    route and the agent will;
  - the models Opus 5.5 may fall back to, read from `allowed_fallback_models` on its model entry,
    each sent the agent's body directly, the first request and the replay, since a fallback runs the
    same request: whether each takes `display: "updates"` and `block_binding`, and what it refuses
    when it does not.
- `updateRichTextYDoc(doc, edit)` in the design system's `lib/`, the half of M13 that has no
  network to wait on: it reads the document as y-prosemirror's binding does, ids included, since
  the stored model has none, applies the edit to the top-level blocks that read produced (a range
  replaced between two ids, blocks appended, one piece of text replaced), and writes the result
  into the shared fragment as a difference, through y-prosemirror's `updateYFragment` on a document
  built from those very nodes, with the read's metadata (see Rich text and Markdown for why not
  `yDocToBlocks`). Tests: a document forked into two, a block typed into on one and another range replaced
  through `updateRichTextYDoc` on the other, merged both ways, read the same blocks with both edits
  and nothing doubled; every block the edit leaves alone keeps its id, and a relative position in
  it survives; a document seeded from `content` and edited reads back the edit.
- Verify: `probeClaude.ts` passes, or each failure has a decision written into the plan; the four
  checks pass.

### M2: The conversation tables

The data model, with nothing yet using it.

- The four tables a run needs, `Conversation`, `ConversationMessage`, `ConversationRun` and
  `ConversationTranscriptEntry`, and their enums, as The data describes, commented in
  `schema.gql`'s style: the transcript's `content`, the run's `context` and `pendingToolResults`
  as `String` columns of JSON text, never `Any` (see The data). `ConversationAttachment` waits for
  M25, the approval fields for M29, and `@searchable` for M12: each is additive, so each release
  migrates by itself.
- No operation yet: the web's arrive with the pages that read them, from M4, and the backend's with
  the routes that call them, from M6. Selections, refreshes and optional variables grow without
  breaking the connector, so nothing has to be guessed now for a milestone twenty away.
- The limits, error codes and gate in strategydance-core, and `buildConversationPreview` there,
  with tests.
- In `CLAUDE.md` § The database: the transcript is backend-only and append-only, with one exception
  (Retry cuts the tail back to a run's anchor; nothing else ever edits or deletes an entry), stored
  as JSON text so it replays byte for byte; the thread is a drawing of it, and messages are ordered
  by a `position` claimed on the conversation's counter.
- Verify: `bun run generate:database` writes both SDKs; the four checks pass; the emulator
  migrates.

### M3: The Markdown component

- `Markdown` in the design system: `react-markdown` and `remark-gfm`, no raw HTML, an allowlist
  (paragraphs, lists, tables through the design system's `Table`, bold, italic, strikethrough,
  links, line breaks), headings drawn as bold paragraphs, a `urlTransform` letting through `http`,
  `https`, `mailto` and `doc:` only, a `renderLink` prop, and a `size` prop for the dock's 14px and
  the page's 16px (`.cv-rt` in the design).
- Built with `remark-breaks` too, so a single newline breaks the line as the design's prototype
  draws it, and with `singleTilde: false`, so "~5 minutes" strikes nothing. An image is its alt text
  and never loads, and whatever else falls outside the allowlist keeps its words. `Table`'s wrapper
  takes focus while it scrolls, so the keyboard scrolls a reply's wide table, as in the dock.
- A story with the design's replies from `conversations-data.js`: lists, a table, links, bold.
- Verify: Storybook, at both sizes; the four checks.

### M4: Navigation, the list and delete

- **No seed.** The plan first had M4 write the design's conversations into the emulators with a
  `bun run seed:conversations <email>` script. David dropped it on 2026-10-04 as not needed, so none
  exists, and no later milestone relies on one: a page is looked at against conversations written
  into the emulators for the check at hand, and from M6 on against ones sent through the route.
  The list's SQL conditions are checked by `check:conversation-list` in the backend, which makes and
  removes its own rows.
- The `conversation` message type (its module and its `MESSAGE_TYPES` entry), registered in
  `_app.tsx`'s `APP_MESSAGE_TYPES`.
- Sidebar: the "Reflection" group with Conversations and Knowledge, Conversations staff only, its
  badge (a `badge` prop on `NavigationLink`, drawn with `SidebarMenuBadge`, with an accessible label),
  fed by `useConversationsAwaitingAnswer`, never by the full list.
- `_app/conversations.tsx`, the parent layout route holding the release bouncer around its
  `<Outlet />`, as `administration.tsx` holds `AdministrationBouncer`, so every page under
  `/conversations/` is gated by it. Under it, `_app/conversations.index.tsx`, its waiter keyed on the organization's
  id, `useConversations` copying `useOrganizationTeam`'s live pattern (`retryOnMount: false`,
  `hasFailed`).
- The list: header (New conversation arrives in M7, search in M12), table, previews worded from
  `preview`, empty states, Delete with confirm and Undo through `DeleteConversation` and
  `RestoreConversation`.
- The web operations the list and the sidebar read and write, as Who writes what describes them:
  `GetConversations`, `GetConversationsAwaitingAnswer`, `DeleteConversation`,
  `RestoreConversation`.
- Tests: wording a preview; restoring at the cap refused.
- Verify: the list at desktop and phone widths against the design; delete and undo; a non-staff
  account sees no item and is redirected.

### M5: The conversation page and its thread, read-only

- `_app/conversations.$conversationId.tsx`, under M4's layout route and so behind its release
  bouncer: search param `isNew` validated, and
  `beforeLoad` refusing an id that is not one, as `knowledge.$documentId.tsx` does; a
  `ConversationOrganizationBouncer` copied from `KnowledgeOrganizationBouncer`, back to the list when
  the organization changes; waiters keyed on the organization's id; `useConversation` and
  `useConversationRun`.
- The page: the bar, the title, the aspects button (on saved conversations: a draft's aspects arrive
  in M23, sent with its first message); `KnowledgeDocumentAspectsDialog` generalized into an
  `AspectsDialog` taking its labels as props; `UpdateConversationAspects`.
- The thread drawing every kind of entry, read-only: text through `Markdown`, tool calls and their
  output dialog (`GetConversationToolCall`), questions in their answered and skipped states (waiting
  ones drawn disabled until M11), notes, aspects notes, the thinking indicator from the run with its
  own one-second timer (`useNow` ticks once a minute), and the missing conversation's state.
- The live tail and the older pages (`GetConversationMessagesBefore`) loaded as the reader scrolls
  up, merged into one thread by a utility with tests: a tail that slides past the pages it meets
  keeps every entry, a gap between them is fetched, and a `historyRevision` change from another
  tab's Retry drops the retried run's entries kept from an older tail, including those of a run
  longer than the tail, whose first entries sit in a history page. Each message's body is read once by id
  through `GetConversationMessageBodies` and kept by id, a placeholder line standing in meanwhile.
- `MarkConversationRead` when the page shows a conversation with unread replies.
- The web operations the page reads and writes, as Who writes what describes them:
  `GetConversation`, `GetConversationMessageBodies`, `GetConversationMessagesBefore`,
  `GetConversationRun`, `GetConversationToolCall`, `MarkConversationRead` and
  `UpdateConversationAspects`.
- Verify: conversations written into the emulators, since there is no seed (see M4), against the
  design at both widths; switching organization on a conversation's page goes back to the list; a
  non-staff account sent to a conversation's address is redirected to `/today`.

### M6: Runs without a model, in the backend's process

The send route and the whole run lifecycle, answered by a placeholder agent, in the backend's own
process. No queue and no composer yet: a script sends, and the page from M5 shows the reply arrive.

- The conversations router, with its member and staff middleware.
- `POST …/messages`, body `{ messageId, text }` for now (later milestones add a draft's aspects
  and attachments), validated on the server: `text` trimmed, not empty (M25 allows that
  with files), at most `MAX_CONVERSATION_MESSAGE_LENGTH`, or a 400. The first message creates the
  conversation (title rule, `MAX_CONVERSATIONS` under the membership lock, pruning what the member
  deleted over a day ago) with its message, queued run and first transcript entry, in one mutation;
  a later one locks the conversation and is refused once it is full (see Size); both hold
  `MAX_ACTIVE_RUNS_PER_MEMBER` and finalize a dead run; then the run goes to `enqueueRun`: 202 with
  the run's id. Idempotent on the client-made `messageId`: a retry completes what is missing and
  answers with the same run.
- `enqueueRun` starts `runConversation` in the process without waiting, as development keeps doing
  for good. Until M8 brings the queue, the route refuses in production with a 503 before writing
  anything, since a run left going after the response would stall once Cloud Run throttles the CPU.
- `runConversation`: claiming, leases, fencing, finishing, drawing with its cursor and deterministic
  ids, and a placeholder agent that writes one `AGENT_TEXT` through the code paths M9 uses.
  `POST …/runs/:runId/reconcile`, which the page calls once its latest run's lease has passed,
  queued or claimed, finalizing a dead one as interrupted (M8 has it ask Cloud Tasks first for a
  queued one). The backend operations for all of it. The page's call was M10's at first; David
  moved it here on 2026-10-05, so a run left by a restarted backend ends with its note rather than
  spinning on the page.
- A script under `scripts/` signs in to the Auth emulator and sends through the route, which is how
  this milestone is driven before the composer: `bun run send:conversation`.
- Tests (database mocked): claiming twice, an expired lease, fencing, finishing only the active run,
  a removed member's run finalized by the worker at its next step, and one whose member was invited
  back before its delivery never resuming, busy, a dead run finalized, a send retried with the same
  `messageId`, a fourth run refused, a send to a full conversation refused, a run at either cap
  sending no further request and ending with its note, an empty, a blank and an over-long message refused; a transcript entry
  whose `tool_use` input has its keys out of alphabetical order and whose text holds U+0000, stored
  and read back as the same bytes.
  Against the emulators, a script under `scripts/` sends from two conversations at once with two
  runs already in flight, and exactly one goes through: `check:conversation-runs`, which checks
  every condition of the run operations, the ones the domain's tests run against a fake of.
- Verify: locally, send with the script while the conversation's page is open in two tabs, and watch
  the reply arrive in both; restart the backend mid-run, see the run shown interrupted a minute
  later, and send again.

### M7: The composer and drafts

- The composer, text only: send, Enter and Shift+Enter, nothing sent while an input method is
  composing, disabled while a run goes; a send that fails keeps its text and is retried with the
  same `messageId`. Drafts: "New conversation" opens `/conversations/<createId()>?isNew=true`, the
  first send creates it, then `isNew` leaves the address as knowledge's does.
- Verify: locally, start a conversation with "New conversation", send in two tabs and watch the
  reply arrive; stop the backend, send, and see the text kept, then sent once it is back.
  Production refuses sends until M8.

### M8: Runs through Cloud Tasks on the worker service, and the daily sweeper

Google Cloud calling the worker: Cloud Tasks for each run, Cloud Scheduler for the daily sweep, both
as `conversation-tasks`, whose token Cloud Run checks. Sends work in production from here.

- Dependencies: `@google-cloud/tasks` (the same google-gax stack `@google-cloud/secret-manager`
  already runs under Bun).
- **The worker service** (see Why a second service): `SERVICE=worker` makes the entry point mount
  `routes/internal.ts` and nothing else, and the backend mounts everything but it, so neither
  answers the other's routes. `deploy:backend` deploys `strategydance-backend` as today, then the
  image it built as `strategydance-worker`, private (the invoker check on), with `--timeout 900`
  and `--concurrency 4`, as the same runtime account. The backend keeps its defaults,
  so the welcome email's ten-minute lease still outlasts any request of its. The deploy workflow's
  header lists what deploying a second service asks of `deployer`, and `CLAUDE.md` § Backend
  conventions says the worker is private where the backend is public, and why.
- `enqueueRun` in production: a named task (`run-<runId>`, so a repeat does not queue twice) aimed
  at the worker's `/internal/conversation-runs`, with an OIDC token for `conversation-tasks` whose
  `audience` is set to the worker's base `run.app` address, without the path, since Cloud Tasks
  would default it to the full address and Cloud Run checks it against its own, a 15-minute
  dispatch deadline, and the queueing failures A run describes; development keeps running
  in the process. `POST /internal/conversation-runs` runs `runConversation`, with its 200 and 503
  answers. The reconcile route asks Cloud Tasks about a queued run's task, pushing its lease back
  while the task exists and finalizing the run once it is gone.
- **The daily sweeper**: the worker's `POST /internal/sweep`, called once a day by Cloud Scheduler,
  removes what is still deleted past its Undo window whether or not anybody comes back:
  conversations deleted over a day ago, with their transcript, runs and messages; later milestones
  add `ConversationSearch` rows (M12), stale upload reservations, unsent files and sent ones'
  folders (M25), and deleted integrations with their credentials (M27). The prunes done on the way
  through stay as a fast path; every step is idempotent.
- Tests (database mocked): an unclear and a definite queueing failure, both leaving the run queued
  for the retry to enqueue; the worker's 200 once its run is finished and 503 while another holds
  the lease; the reconcile route keeping a queued run whose task exists and finalizing one whose
  task is gone; the sweeper claiming a conversation before deleting it, a restore refused once it is
  claimed, and a prune that failed after claiming finished by the next sweep; the backend answering
  404 on `/internal/*` and the worker on everything else.
- Built with one addition, David's choice on 2026-10-07: M7's composer sends nothing while the run
  it shows is queued, so a send whose task could not be queued brings the run's lease in to now,
  and the reconcile route queues a run whose task is gone again while it is under twenty minutes
  old (see A run § Queueing). The sweep claims everything at once and deletes twenty conversations
  at a time.
- Verify: setup steps 3 and 4 before the release, then, once it has deployed the worker, step 3's
  invoker grant on the worker and step 6; then,
  as staff in production, send and watch the task in Cloud Tasks' logs and the reply arrive; call
  the worker's address without a token and see Cloud Run refuse it; the sweeper's first run in
  Cloud Scheduler's logs.

### M9: Claude replies, with web search

- `domain/agent/`, on the SDK M1 installed and the request shape its probe settled: the client and its scripted double, the system prompt and its byte test, the
  context message and its hash, `checkTranscript` and its tests, storing the transcript (the context
  message with the first assistant turn), the request, the streamed turn (progress lines to
  `run.step`), drawing a turn with each insert claiming its positions, `web_search`, usage per model
  and per request, cache reads and writes included, `preview` and `unreadCount`; and `isFull`, set
  before a request whose input would pass 800000 tokens, counted as Attachments says, from the
  latest request whose input and turn the transcript still holds, its whole input, cached
  included, and its output, plus what the transcript holds after it, so a long
  conversation shows full rather than failing every request (M25 adds the files' stored counts).
- The thread: progress lines in the indicator; web search calls drawn ("Searching the web", output
  listing the results); citations drawn as numbered links after their spans, with the sources under
  the message.
- Tests (scripted client): consecutive requests share a byte-identical prefix; `checkTranscript`
  accepts every flow so far and rejects each broken shape; text blocks merge with their citations'
  offsets kept right; a reply past 20000 characters drawn as pieces split between blocks, a single
  long block split at a line break, a 50000-character line with no break split at spaces, and one
  with no space at grapheme boundaries, an emoji sequence across the bound kept whole, every piece
  within 20000 characters and the pieces rejoining to the original; citations rebased to their piece, one unread count, and a
  crash between two pieces drawing the rest once; a web search becomes one finished call; usage
  adds up; a request that would pass 800000 input tokens never sent, the conversation marked full
  and the send route refusing, and a `pause_turn` continuation counted from the paused request, so
  parts held in memory that take it past the limit stop it too; a conversation near the limit
  whose tools list grew in a release counted with the growth, and stopped by it.
- Built with these settled, on 2026-10-08: a paused turn's responses are its parts, and a long
  text's slices its pieces; the parts are stored after the turn ends, one write each, so a crash
  between two leaves a paused part last, which the next worker continues, as the run's usage ledger
  says it paused; the piece cursor is a column of its own, `drawnPieces`; the development backend
  asks the real model unless started with `CONVERSATION_AGENT=placeholder`; a citation's marker is
  placed by its offset in the Markdown, and a reply's sources are numbered across its pieces.
  Verified with the real model: the second run of a conversation read from the cache exactly what
  the first had written, so the first turn replays byte for byte, and `input_transformations` stayed
  empty. Found: Opus 5.5 called every search from code, which leaves its replies without citations,
  and `allowed_callers: ["direct"]` brings them back, which is David's call (see Drawing a turn).
  Not seen with the real model: a `pause_turn`, a reply past 20000 characters, and the 800000 limit,
  which the scripted tests cover.
- Verify: ask a question that needs the web and one that does not; watch the indicator's progress
  lines when they come, across a run of several tool calls, and its tool labels otherwise; check the
  logs show `input_transformations` empty across turns, and cache reads on every request after a
  run's first.

### M10: Stop, resume, retry, failures and refusals

- Routes `…/stop`, `…/resume`, `…/retry`, as The transcript describes, finalizing dead runs.
- The worker: aborting on the stop flag, cancelled calls, notes; failures (`FAILED`, the reason in
  `failure`, a note) after the SDK's retries, at the step and time limits, and on `max_tokens`;
  refusals and their fallback, as The agent describes.
- The composer's Stop button; the notes with Resume and Retry as the design offers them. A run past
  its lease already ends interrupted, with its note, through M6's reconcile.
- Tests: a stop mid-stream drops the turn and stores no context message; resume runs the unanswered
  `tool_use` blocks; a turn of more tool calls than the tail holds drawn whole, and its run retried
  from a thread whose tail no longer reaches its first entry; retry goes back to the run's anchor,
  for a files-only message and for an
  answer, and from a resumed run that crashed before storing its results, back to the anchor it
  shares with the run it resumed, deleting what both drew; every cut passes `checkTranscript`; a
  Resume and a Retry whose queueing failed finished by their own retry, which creates the named
  task again and answers with the same run; Retry setting `unreadCount` to 0, with a
  `MarkConversationRead` in flight across it leaving the count right; retrying many times lowers
  `messageCount` by what it deletes, so it never fills the conversation, and so does stopping and
  resuming many times; Resume at the cap starting a run that ends at once with the full note and
  sends no request, and Retry giving the room back; a conversation marked full by its context,
  retried back under the limit, counted from a request the cut left whole and no longer full;
  sending after a stop answers the open blocks; a turn with a
  `fallback` block is stored without the blocks before its boundary, and a conversation served by
  its fallback model afterwards stored and drawn as any other.
- Verify: stop during a web search, resume, retry; kill the local backend mid-run and resume after.
- Built with these settled, on 2026-10-08:
  - **Client calls go to M11**, as David chose: no client tool existed yet, web search running on
    Claude's side, so M10 stops, resumes and retries text and web search, and M11, which builds the
    first client tool, takes the loop that runs one and every test of M10 above that needs one (see
    M11). Retry for a files-only message goes to M25, and for an answer to M11.
  - The routes name the run the page shows: `POST …/runs/:runId/stop`, `…/resume` and `…/retry`,
    beside the reconcile route. A Resume or a Retry received again finds the run numbered right
    after the one it names, and answers with it, queueing its task again while it waits.
  - The worker reads the stop flag before each request and every two seconds while one streams. A
    turn already answered when it reads the flag is stored and drawn, since it was paid for, and the
    run ends as that turn does.
  - A resumed run carries on the turn of the run it resumes: it draws what that run stored and left
    undrawn under its own name, and sends a paused part's continuation with no context message of
    its own. Drawing finds an entry by its id and cursor, no longer by the run that stored it.
  - No request starts once 10 minutes have passed since the run's first claim, and a stream still
    going at 14 minutes is cut, so the run ends inside the task's 15-minute delivery.
  - The thread draws the text on both sides of a fallback's boundary as one reply, and the ledger
    keeps what a declined attempt used, read from `usage.iterations`, under the model that declined.
  - Every run that ends with a note says why in its `failure`, and `FinishConversationRunWithNote`
    pairs each status with its own note.
  - Verified in the browser at 1280 and 390 wide, with the placeholder: stop, resume and retry;
    Retry alone under a failed note; the backend killed mid-run, the run interrupted a minute later,
    and resumed. With the real model: a question that searched the web, stopped six seconds in,
    ended stopped, its request charged as an estimate, and resumed into a reply with two searches;
    a follow-up stopped and retried read 41577 tokens from the cache, so the transcript the retry
    cut replayed byte for byte, and `input_transformations` stayed empty.

### M11: Questions

- **The loop that runs client calls**, which M10 left to the first milestone with a client tool
  (David's call on 2026-10-08), as A run § The loop and Recovery and side effects describe it: a
  `tool_use` drawn as a `TOOL_CALL` `RUNNING` before it starts, its start and result written in
  fenced writes, consecutive read-only calls four at a time and the others alone, 10 a turn and 50
  a run, 60 seconds each, and one `USER` entry holding every result in order. Stop lets the calls
  already running finish and cancels the rest; Resume runs those that never started and the
  built-in ones without a result; a send after a stop answers the open calls before its text, as
  The transcript describes. With M10's tests that need a client call: resume runs the unanswered
  `tool_use` blocks; a turn of more tool calls than the tail holds drawn whole, and its run retried
  from a thread whose tail no longer reaches its first entry; retry from a resumed run that crashed
  before storing its results, back to the anchor it shares with the run it resumed, deleting what
  both drew; sending after a stop answers the open blocks; retry for an answer goes back to the
  run's anchor.
- `ask_user`, its `QUESTION` messages, and `WAITING` runs with their `pendingToolResults`.
- `POST …/answers` with `{ messageId, selected, other }`, serialized on the waiting run as The
  transcript describes, and skipping on send. The answer is checked against its stored question
  before anything is recorded, since it goes into Claude's transcript: `selected` holds distinct
  options of that question only, at most one for a single-choice question; `other` is one trimmed
  line of at most 500 characters (`MAX_ANSWER_OTHER_LENGTH`); an answer chooses at least one option
  or writes something; and a single-choice answer is exactly one of the two, an option or its own
  words, as the radios draw it.
- The question's waiting state in the thread, "Needs your answer" in the list, the
  sidebar badge, and questions in previews, all read from `isAwaitingAnswer`, which ending a run
  `WAITING` sets and consuming its turn clears.
- Tests: an `ask_user` call whose prompt or one option is a character past its bound refused before
  anything is drawn, and one at the bounds drawn; a prompt or an option holding a control
  character, U+0000 included, refused the same way, and an answer's own words holding one refused
  before anything is recorded, so a continuation built later, after a restart or another answer,
  sends exactly what was answered; an unknown, repeated or second option for a
  single-choice question refused, an empty answer refused, a long `other` refused, an option and own words together on a single-choice
  question refused; two questions in one turn wait for both answers, and two answers sent at once start exactly
  one run; the waiting run moved to `CONTINUED` by the winner, and a delayed answer or send, arriving
  after the winner's run has finished, consuming nothing; the preview following an answer to the last question shown, and staying put for an
  answer to an earlier one; a skipped question's result; the other tools' results go back with the answers, in
  order; a backend stopping between the last answer and its continuation, finished by the answer
  sent again and by the reconcile route; a question waiting in a conversation at the cap, answered,
  starting a run that ends at once with the full note and sends no request, so the badge clears; a
  member
  with three runs in flight answering, the continuation starting once one ends.
- Verify: ask the agent to help choose a price, answer with an option and your own words, then skip
  one by typing.
- Built with these settled, on 2026-10-08:
  - **A stop among a turn's calls leaves a question waiting**, as David chose: the calls running
    finish, the rest never start, and a run whose turn drew a question ends `WAITING` rather than
    `STOPPED`, since the question is on the member's screen and the turn was paid for; the calls it
    kept from running are answered as stopped. The run's ten minutes do the same.
  - **What becomes of each call is planned from the transcript alone** (`planConversationToolCalls`):
    a question past its bounds draws nothing and is answered with why, and a call past the ten or
    the fifty, or to a tool nobody runs, is drawn as failed with the sentence it is answered with.
    The fifty count since the run's anchor, so a resumed run shares its budget.
  - **One builder answers a turn's calls** for the worker, a continuation and a send
    (`buildConversationToolResults`), in the turn's order, which corrects The transcript's Send.
  - **Results are kept on the run** in `pendingToolResults`, written with each call's result and
    copied onto a resumed run, and the finalizers cancel running calls conversation-wide.
  - **"Waiting" is the conversation's**: the answer's lock matches `isAwaitingAnswer`, and the page
    answers a question while the conversation waits, so a question drawn by a run that died is
    answered once its resume waits. The answer is counted against the other questions still
    waiting, since a mutation's read does not see its own write.
  - **The answer route** answers 202 with the continuation's run, or with none while another
    question waits or the member has three runs going, when the page reconciles a run waiting on
    questions all answered five seconds in and every two minutes after.
  - **Found with the real model**: the count endpoint refuses a tool result without its call, so
    every request after a tool turn failed its measurement; such a request is counted whole now, and
    the tests' scripted client refuses such a count as the API does.
  - Verified in the browser at 1280 and 390 wide, with the real model: a request for help with a
    price brought a single-choice question, answered in own words, the sidebar badge, the list's
    "Needs your answer" and its "Question: …" preview showing while it waited; a several-choice
    question answered with an option and own words; one skipped by typing, drawn as skipped, and the
    badge cleared. The continuation that first died on the count was resumed into searches and a
    reply. `bun run check:conversation-runs` passes against the emulators, the two races included.
    Not seen with the real model: a stop among calls, since `ask_user` is the only client tool yet,
    which the scripted tests cover.

### M12: Searching conversations

Search arrives once there are real conversations to search, and on its own, since it carries the
plan's one open question about Data Connect.

- `@searchable(language: "simple")` on `Conversation.title` and `ConversationMessage.text`, additive.
  Check first that Data Connect and the emulator take `simple`; if not, every search takes the
  bounded substring path until a configuration that does not stem is available, never `english`,
  which stems, so "run" would match "running", and changes the other languages. Chinese and
  Japanese go through the substring path conversations.md describes, since no text search
  configuration splits them.
- `POST …/conversations/search`, as Who writes what describes it, with its backend-connector search
  operations, the in-memory limiter, and the `ConversationSearch` table its shared quota counts,
  additive. The daily sweeper deletes its rows over a day old.
- The list's search field: debounced, aborting the request it replaces, bounded as the route is, and
  the no-match and best-matches states.
- Tests: the search route merging titles and messages, deduplicating by conversation, and stopping
  at 1000 conversations or ten pages; a Chinese and a Japanese query taking the substring path,
  which reads at most 20000 messages, newest conversations first; a query past 100 characters or 8
  terms refused; the 121st search from one caller in ten minutes refused by the in-memory limiter
  and, with a fresh limiter as another instance would have, by the shared count, which is per
  organization (database mocked); against the emulators, a script running two searches at once at
  119 lets exactly one through.
- Verify: search real conversations in English, French, Chinese and Japanese; a word that only an
  agent's reply holds; a narrower search after the best matches.
- Built with these settled, on 2026-10-09:
  - **`simple` works**, on the emulator (3.4.21) and in the SQL it writes: each `@searchable`
    column becomes a generated `tsvector`, `to_tsvector('simple'::regconfig, …)`, with a GIN
    index, an additive migration. Capitals and accents ("ÉQUIPE", "été") and French elisions
    ("l'équipe") match, and "run" misses "running".
  - **A `_search` takes `where` with relation filters, `limit` and `offset`, but its `orderBy`
    cannot name the relevance**, so pages read by offset could repeat a message across a tie at
    their boundary and skip another, then answer every match all the same. The messages are read
    once, the 5000 most relevant, rather than in ten pages of 500: one ranking of the matches
    rather than ten, and a single snapshot.
  - **A filter level holds plain fields or `_and`/`_or`, never both**, so the substring search
    nests the caller's fields in an `_and` entry. It is one query over conversations: a title
    matching every pattern, or, among the recent ones, a member or agent message that does
    (`exist`). It always takes eight patterns, the backend filling those a query leaves over with
    `%`, so none is optional.
  - **The route answers ids and a `coverage`**: `ALL`, `BEST_MATCHES` once a 5001st message,
    read as a sentinel, says the 5000 left some out short of every conversation, or `RECENT` once
    the substring path left some conversations' messages unread. The page filters its live list by the ids, so the results keep the list's order and
    stay live. The recent note shows only when a conversation was actually left out.
  - **A refused record is read again** (`GetConversationSearchQuota`), to tell the allowance used
    up, with `Retry-After` from the 120th newest search, from a membership gone.
  - **The in-memory limiter is made per router**, so a second router in a test stands for another
    instance, and the shared count refuses what its fresh limiter lets through.
  - **The field is the design system's new `SearchInput`**, an `Input` with a magnifier, built as
    `PasswordInput` is. Past eight words it says so and sends nothing. The results are mounted only
    while the field holds something, so clearing it forgets the last search; while a newer search
    loads, the last answer stays.
  - Verified with `bun run check:conversation-search` against an emulator of the branch's schema,
    the two searches at once at 119 included, and in the browser at 1280 and 390 wide: English,
    French, Chinese and Japanese conversations, a word only the agent's reply held, through the
    placeholder's real run, the best matches over 6000 matching messages and the narrower search
    after them, the recent note past 20000 messages, no match and Clear search, Escape, a ninth
    word, a typed word sent once, a slower search aborted by the next, and a 429. Not seen with the
    real model's replies, which the search reads as it reads any other agent text.

### M13: Rich text, Markdown and shared documents on the backend

Two pure functions and the backend's way into a document's shared text, no visible change and no
database: the operations that read and fold a document arrive with the Knowledge module, which
calls them, in M14.

- The backend gains `strategydance-design-system` as a workspace dependency and imports its
  `lib/` modules as the web does, by their exported `strategydance-design-system/lib/*` paths,
  never a component. Those import `@blocknote/core`, `y-prosemirror` and `yjs`, not React and not
  the DOM, and the image already installs the whole workspace. The backend's `tsc` follows those
  imports into the design system's sources, so the two tsconfigs' options that matter to them
  agree, as `CLAUDE.md` asks of the emails package's. strategydance-core stays without
  dependencies.
- `richTextToMarkdown(blocks)` and `markdownToRichText(markdown)` in the design system's `lib/`, for
  the subset, the second on markdown-it (see Rich text and Markdown), with tests: round trips of all
  four styles, underline through `<u>…</u>` included, alone and nested in the others; another tag
  kept as literal text; nesting, check items, links, what degrades to paragraphs, lengths against
  `MAX_DOCUMENT_CONTENT_LENGTH`.
- `domain/knowledge/` in the backend, on M1's `updateRichTextYDoc`, working on rows rather than
  calling the database: reading a document's shared text from its snapshot and pending updates
  through `yDocToBlocks`, once a read tried on a copy has left it unchanged, as
  `updateRichTextYDoc` checks it, as top-level blocks with their ids and Markdown, or, for a document with no
  snapshot yet, building the seed M14 stores before it hands out any id; and
  turning an edit into a fold, the new `state`, `content` and `contentText` and the ids of the
  updates it merged, as Rich text and Markdown describes.
- Tests: a document with pending updates read with them; one without a snapshot read from its
  `content`, and its first edit seeding it; a fold's state merged into a tab's document that typed
  meanwhile, keeping both; a fold read back through `readRichTextYDoc` equal to the edited blocks;
  an edit longer than an update may be folded whole.
- Verify: the four checks; knowledge, the log, priorities and build in public cards draw as before.

### M14: The Knowledge module

The module itself, its data and its MCP server, as Modules describes them: nothing in the app calls
it yet, and Claude Code reaches it locally over stdio.

- Dependencies: `@modelcontextprotocol/server` and `@modelcontextprotocol/client`, the SDK's second
  major version, at its latest release past the seven-day cooldown. Tests drive the module as
  Strategy Dance's agent will, through a `Client` pinned to the 2026-07-28 revision whose
  transport's `fetch` is the module's handler (see Modules § Strategy Dance's agent), never through
  the in-memory transport, which the SDK keeps for tests of the 2025 revisions.
- **A searchable plain text for documents.** `Document` gains `contentText`, the plain text of what
  `content` holds (`getRichTextText`), `@searchable(language: "simple")` beside a searchable
  `title`, so `search_documents` reads an index rather than scanning stored JSON. Like `content`, it
  is as fresh as the last fold, which is enough to find a document; `read_document` always reads
  the shared text. A null `contentText` means "not indexed yet", and nothing may leave it stale:
  - Every write of `content` writes it: the backend's folds and creates, and the web's through new
    operations, `CompactDocumentWithText` and `CreateDocumentWithText`, which take `$contentText` as
    required, and join every refresh that names the operations they replace: `GetLiveDocument`'s
    for both, `GetOrganizationDocuments`' for the create. The old `CompactDocument`, `CreateDocument` and `UpdateDocumentContent` stay for
    bundles still open from before, with the same variables, and now write `contentText: null`
    beside the content (their data block is the server's, so the change reaches old bundles too).
    An optional `$contentText` on the existing operations would not do: an omitted optional variable
    leaves its column alone in an update, so an old bundle's fold would leave stale text indexed.
  - Existing documents, which start null, are filled by a backfill script under `scripts/`, run by
    hand after the release: it pages through null rows in batches and can stop and resume at any
    point, so no request ever carries it.
  - Before `search_documents` reads the index, the backend reindexes up to 20 of the organization's
    null rows from their `content`, enough for the occasional fold from an old bundle. When null
    rows remain after that, the result says the index is still being built and the search may be
    incomplete, so the model can retry later or read the documents it already knows.
  - Both the backfill and the on-demand reindex write `contentText` only where the document's
    `revision` is still the one they read, so a fold that lands in between, which nulls
    `contentText` again, is never overwritten with text from before it; a conflict stays null for
    the next pass. Tests cover a fold landing between the read and the write.
- Creating and restoring keep the knowledge cap as `CreateDocument` and `RestoreDocument` do: the
  backend's create and restore lock the organization's row and count fewer than `MAX_DOCUMENTS`
  live documents before writing, so an agent and the browser cannot race past it, and a full
  organization comes back to the model as a failure it can explain.
- **The frame**: `MODULES` in strategydance-core, each module's name, path, title and scopes;
  `src/modules/` in the backend, mapping each name to `createServer(caller)` and the
  `createMcpHandler` around it; the caller's type and `toModuleAuthInfo`, which carries it in
  `AuthInfo`'s `extra`; and a test that every module's tool names are unique across `MODULES` and
  match Claude's `^[a-zA-Z0-9_-]{1,128}$`.
- **The eight tools**, as Modules describes them, on M13's `domain/knowledge/`: zod input schemas,
  `outputSchema`s with `structuredContent` and its JSON as text, annotations, failures as `isError`
  results with a sentence to act on, the server's instructions, and documents' web addresses for an
  external caller only.
- Backend-connector operations, named `…ForAgent`: search candidates, list, read one (title,
  aspects, AI permissions, `revision`, `state`, its pending updates and `content`), create, fold,
  retried on a moved revision three times at most (the shared text with `content` and `contentText`,
  the title, in one write of the row), set aspects, delete and restore. Each is guarded on the
  membership and its `membershipCreatedAt`, `deletedAt`, `isAiReadable` and, for writes,
  `isAiWritable`, and for delete and restore on both; each write is an `@transaction` inserting its
  `ModuleCallResult` first when it carries a key; and each is named in `GetLiveDocument`'s
  refreshes, and in `GetOrganizationDocuments`' only when it changes what a card shows: the create,
  the aspects, the delete and the restore, and the fold on a condition that it carries a title,
  never a fold of the text alone. A delete prunes the organization's documents deleted over a day
  ago, as `DeleteDocument` does, and a restore refuses a document deleted over a day ago.
- **`ModuleCallResult`**, keyed on its scope and key, as Modules § Idempotent writes describes. The
  daily sweeper deletes the expired rows, and prunes documents deleted over a day ago in every
  organization, so a day means a day whether or not anybody deletes another.
- `bun run mcp:knowledge <email> [--organization <id or slug>]`, under the backend's `scripts/`:
  the module over the SDK's stdio transport, as that account, against the emulators only, as
  `send:conversation` signs in, its idempotency scope a fresh `connection:<uuid>` each time it
  starts. Claude Code adds it with `claude mcp add strategydance-knowledge-local -- bun run
  mcp:knowledge <email>`.
- `CLAUDE.md`: a Modules section, saying what a module is, where its code goes, how its tools are
  named, that every write inserts its result under its key first, and that the AI permissions hold
  for every caller.
- Tests (database mocked, through an SDK `Client` on the module's handler): a document kept from AI
  neither found, listed nor read; one AI may not change refused, including one whose permission goes
  off between the read and the fold; a stale `version` refuses `content`, and so does `content` sent
  without one, before anything is written, including when a push lands between the read and the
  fold, while `replaceBlocks`, `append` and `replaceText` go through as somebody types elsewhere;
  two reads in a row hand out the same block ids, and so do a document stored before the editor was
  shared and read twice, and one a tab seeds while the backend reads it; a write called twice with
  one key applied once, `append` included, the second answered with the first's result; one key with
  other arguments refused, and one key sent to `delete_document` then to `restore_document` with the
  same `{ id }` refused; two calls at once with one key making one write; a fold that loses a
  revision race checking its key again before it reapplies; a create in a full organization refused,
  and a created document readable and writable by AI; a 200000-character document read in pages that
  join back whole, and one made of a single 200000-character paragraph too; a page asked for after
  somebody typed elsewhere carrying on from its block, one after an edit inside the block it stopped
  in starting that block again, and one whose block was deleted starting the document again; a fold
  refused on a moved revision read again and reapplied, and a push landing during a fold left
  pending; a block range replaced between two ids without touching the rest, and refused once one of
  them is gone; an append and a replacement that would take the document past 200000 characters of
  content refused, its text and its pending updates left as they were, and the same on a retry after
  somebody else's fold; a unique piece of text replaced inside that paragraph, and a text that
  occurs twice refused; search reading the index and loading the plain text of 20 candidates at
  most; a fold through the old operations nulling `contentText`, and the next search reindexing it;
  a Chinese and a Japanese search finding a word inside a document's sentence, reading the content
  of the 100 latest documents at most; Markdown in, the document draws as written; an
  `update_document` naming `content` and `append` together, or nothing to change, refused before
  anything is read; the list paged in fifties, two documents updated at one instant on either side
  of a page's end neither skipped nor repeated; aspects replaced, and a repeated one refused; a
  delete refused when AI may read but not change, and when it may change but not read; a restore at
  the cap refused, and one past a day refused; an external caller's results carrying addresses, by
  its id for an organization without a slug, and the agent's none; a caller without the write scope
  refused by every write tool, nothing written; an argument past its schema's bound, a 101-character
  query say, answered as an `isError` result the model can read, as the SDK turns a failed input
  validation into one; a removed member's call refused, and so is one carrying the
  `membershipCreatedAt` of a membership since ended, after the member was invited back.
- Verify: with `bun run mcp:knowledge` added to Claude Code locally, search, list and read; with a
  document open in a tab, have Claude Code write into it and watch the edit arrive while you type
  elsewhere in it, your caret staying put; create one, tag it, delete it and restore it; turn Write
  off on one and ask again; turn Read off on it and ask about it.
- Built with these settled, on 2026-10-09:
  - **The SDK is 2.2.0**, the latest release past the cooldown that day (2.3.0 passed it hours
    later). `createMcpHandler` adds the 2026-07-28 revision to each server it builds, so a plain
    `McpServer` serves both eras; a tool reads the call's `_meta` at `ctx.mcpReq._meta`; an input
    that fails its schema comes back as an `isError` result naming the field; stdio is
    `serveStdio(factory)`, which serves a 2025 client, as Claude Code is by default, and a 2026 one.
  - **`@include(if: $isKeyed)` skips a mutation's step**, inside its transaction, so a write without
    a key inserts no `ModuleCallResult` without a second operation. A key taken answers `violates SQL
    unique constraint: module_call_result_pkey (aborted)` and writes nothing, and three writes at once
    under one key land once.
  - **A mutation takes one `query` step.** `FoldDocumentForAgent` reads the pending updates once its
    row is locked, so the membership's and the variables' checks join that step, after the writes,
    which a refusal there rolls back all the same. `CLAUDE.md` records both.
  - **Data Connect builds one `tsvector` over `title` and `contentText`**, so `PLAIN` needs every
    word in the two together, not in either alone: "marketing partnerships" finds a document titled
    "Marketing plan" whose text holds "partnerships".
  - **`aspects: { includesAll: [] }` matches every document, and `null` matches none**, so the
    aspects filter is always a list. Search and list take the documents tagged with every aspect
    named, as search takes every word: Data Connect has no "any of".
  - **A filter on a UUID takes no `gt`**, so the list cannot read past a cursor's id. It reads the
    documents changed at the cursor's instant apart, all of them by id, keeps those past the
    cursor's id, then those changed before it. An instant read back matches itself to the
    microsecond.
  - **`has(mutation.variables.title)` gates the list's refresh on a fold**, checked with live
    subscriptions: a fold of the text alone pushes the open document and not the list, one with a
    title both. The backend's dashless ids match the browser's in a refresh condition.
  - **A title alone is a rename**, `RenameDocumentForAgent`, rather than a fold that rewrites a
    snapshot unchanged; a title beside a text edit rides in the fold's one write of the row. An
    omitted `$title` leaves the column alone, and a null one would write null into it, so the
    backend leaves it out.
  - **`version` comes only with a page that holds the whole document**, a hash of every block's id
    and Markdown, since `content` replaces a document small enough to read whole: a longer one is
    edited by its blocks. Whatever a cursor says, a page that holds everything was read whole, so
    the cursor needs no signature to keep an agent from a version of text it did not see. An update
    answers a version only once it replaced the whole text, which the agent then wrote whole.
    `content` without a version is refused before anything is read.
  - **A page's budget counts its JSON**, each block's Markdown as escaped, so a page of quotes,
    backslashes or line breaks stays as far short of a result's 50000 characters as one of words.
  - **A document keeps a title or some text.** An update that would leave it with neither, a blank
    title on a textless document or an edit emptying an untitled one, is refused, as creating one
    with neither is, since the page deletes a document somebody empties rather than keep it. The
    rename and the fold check it in their query step, after the write that locks the row, so two
    such calls at once cannot pass it together.
  - **A stored result answers only the member who made it**: the key's lookup reads the membership
    the module read, so a member removed, or removed and invited back, is refused as the write would
    refuse them.
  - **The substring search takes each word from the title or the text**, as the full-text search
    does, each pattern in the title or in the text of a recent document.
  - **Search answers at most 10 of its at most 20 candidates**, with `hasMore` when more matched and
    `isIndexComplete` false while documents an old page left unindexed remain.
  - **The page's `RestoreDocument` refuses past a day too**, not only the agent's restore, so a day
    means a day wherever a restore starts, which M16's Restore in the thread relies on.
  - **A search and a list refuse a removed member** rather than find nothing: the reads they start
    with return the membership beside the documents.
  - **An answer from a key carries the address again**: the result kept under a key is the domain's,
    small, and the tool adds an external caller's addresses to it each time it answers.
  - **The stdio script points `console.log` at stderr**, since the backend's logger writes its info
    lines to stdout, the protocol's channel there, and the root script runs it with
    `bun run --silent`.
  - Verified with `bun run check:knowledge-module` against an emulator of the branch's schema, every
    check passing; with the SDK's stdio client driving `bun run mcp:knowledge` as Claude Code would,
    every tool; in the browser at 1280 and 390 wide, a document the module created open in a tab
    while the member typed at the end of its first paragraph and the module appended a block and
    replaced text in its third, both arriving without a reload and the caret staying put, a retry
    under its key changing nothing, Write then Read turned off and refused, delete and restore; a
    document made on the page stored with its plain text, and a paste too long to push compacted
    with its; and the backfill over 270 unindexed documents, run again with nothing left. Not seen
    from Claude Code itself, which `claude mcp add strategydance-knowledge-local -- bun run
    mcp:knowledge <email>` connects.

### M15: The Tasks module

The team's tasks as Strategy Dance's second module, on M14's frame, as Modules § The Tasks module's
tools describes it: nothing in the app calls it yet, and Claude Code reaches it locally over stdio.

- **The frame's second module.** `MODULES` gains `tasks` (`/mcp/tasks`, "Strategy Dance Tasks",
  `tasks:read` and `tasks:write`), and `MODULE_SERVERS` its `createTasksServer`, whose tool names
  `moduleServers.test.ts` checks against Knowledge's. `src/modules/tasks/` holds the eight tools,
  one file each, on `domain/tasks/`, beside the sweep's `pruneDeletedTasks`.
- **The board's helpers move to strategydance-core**: `getPositionBetween`, and what
  `getTaskBlockers`, `getTasksUnblockedBy` and `getTaskPrerequisites` compute, rewritten over plain
  shapes (an id, whether it is done, the ids it waits on), so they import no database type, as M14
  moved `toOrganizationPathSegment`. The web imports them from there, their tests moving with them,
  and nothing visible changes.
- **A searchable plain text for descriptions.** `Task` gains `descriptionText`, the plain text of
  its description, null meaning not indexed yet, as Modules § The Tasks module's tools describes it.
  The board writes it through new operations, `CreateTaskWithText` and
  `UpdateTaskDescriptionWithText`, with `getRichTextText(parseRichText(description))`, and the old
  `CreateTask` and `UpdateTaskDescription` now write null beside the description, their data block
  being the server's. `bun run backfill:task-text --production`, under the backend's `scripts/`,
  fills existing tasks once the release has deployed, paging through null rows, and can stop and
  resume at any point, as M14's `backfill:document-text` does.
- **The page's `RestoreTask` refuses a task deleted over a day ago**, a condition in its `where`
  rather than a variable, so no connector change breaks and a day means a day wherever a restore
  starts.
- Backend-connector operations, named `…ForAgent`, each matching the membership on
  `membershipCreatedAt` and answering it beside what it reads, so a removed member is refused rather
  than shown an empty board:
  - reads: the board, without descriptions, with each task's links, `createdBy` and `updatedAt`, and
    the members' ids and names; a query's matches, the ids of the tasks whose name or
    `descriptionText` matches its pattern, and up to 20 tasks not indexed yet, with their
    descriptions; one task, with its description and its links both ways;
  - writes, each an `@transaction` inserting its `ModuleCallResult` first under `@include(if:
    $isKeyed)`: create, under the organization's lock and `MAX_TASKS`, with `CreateTask`'s checks on
    the name, the description's length, the aspects and the assignee; update, writing the fields it
    is given, on a condition on the `updatedAt` it read, with the same checks on what it writes; add
    a link, under the organization's lock with `AddTaskDependency`'s checks; remove one, refused
    when there is none; delete, refused for a task already gone and pruning the organization's tasks
    deleted over a day ago as `DeleteTask` does; and restore, under the lock and `MAX_TASKS`, within
    a day; and the index, writing a task's `descriptionText` only while its `updatedAt` is the one
    read, and moving no `updatedAt` itself, since the task did not change.

  Each write is named in `GetTasks`' refreshes, the update on a condition that it carries a field a
  card shows, and the update carrying a description, the delete and the restore in
  `GetTaskDescription`'s. None records an `ActivityDay`.
- `bun run mcp:tasks <email> [--organization <id or slug>]`: M14's stdio script, taking the
  module's name, so `mcp:knowledge` and `mcp:tasks` run one file. Claude Code adds it with
  `claude mcp add strategydance-tasks-local -- bun run mcp:tasks <email>`.
- `bun run check:tasks-module`, under the backend's `scripts/`, checks the operations' conditions
  against the emulators, as `check:knowledge-module` does, beside a `createTasksDatabaseFake` the
  tests run against; the test kit, `createKnowledgeModuleTestKit` made to take the module, drives
  either.
- `CLAUDE.md`: Module conventions say that tasks carry no AI permission, every agent changing any
  task as any member can; § The database's rule on `ActivityDay` says that an agent's change to the
  board never counts; § The database says that every write of a task's description writes
  `descriptionText` beside it, or nulls it; Commands gain `mcp:tasks` and `check:tasks-module`, and
  Module conventions `backfill:task-text`.
- Tests (database mocked, through an SDK `Client` on the module's handler): a removed member's call
  refused, and one carrying the `membershipCreatedAt` of a membership since ended; a caller without
  the write scope refused by every write tool, nothing written; a write called twice with one key
  applied once, the second answered with the first's result, and one key with other arguments
  refused; two creates at once at 999 tasks making one; a created task at the end of its column, the
  member's unless told otherwise, and a name with a line break or past 120 characters refused; a
  description in Markdown stored as a post's blocks, a table and a code block read back as
  paragraphs that keep every cell's and every line's text, and one past 20000 characters serialized
  refused; a description sent with a stale `version`, or without one, refused, nothing written; a
  task with a 20000-character description of asterisks and backslashes, 50 tasks it waits on and 999
  waiting on it, all named in 120 characters, read within 45000 characters, its description as plain
  text without a `version` and each list cut at 20 with its count, and a description that fits read
  whole with its `version`; the agent's move and a member's rename landing at once both kept, the
  update reading again and reapplying; a move between two tasks placed halfway, one into a gap too
  narrow refused with nothing written, a `beforeId` naming the task itself leaving it where it is in
  its own column, and refused with another `status`, and a move to Done answering the tasks it
  frees, and on a board of 1000 tasks waiting on one, the first 50 and a count of 999, within a
  result's 50000 characters; a `beforeId` in another column refused; an assignee who is not a member
  refused, a member named `member:<id>` assigned, a bare id refused, and a member whose id is
  `agent` assigned as a member, and `"agent"` taking the task off the member; a task waiting on
  itself refused, and loops of two and of three tasks refused with their tasks named, and one
  through all 1000 tasks refused naming the first 20 and its length; a 51st link refused; removing a
  link that does not exist refused; a delete keeping the links, a restore bringing them back, a
  restore past a day refused, the page's too, and one whose links would close a loop with a link
  made while it was deleted refused; the list paged in hundreds, two tasks at one position on either
  side of a page's end neither skipped nor repeated, `total` right, and the members on the first
  page alone; a query found in a name and in a description whatever its case, one half in bold
  found, a query of `type` or `text` matching no task whose name and plain text lack it, null rows
  indexed before a query, 20 at most, with `isIndexComplete` false while more remain, and a
  description saved between the index's read and its write left null, and one past 100 characters
  refused; a name, a description and a query holding U+0000 refused before any operation runs, and a
  query of `%`, `_` and `\` matching only the tasks that hold them as written; a done task waiting
  on an unfinished one never blocked, in `list_tasks`, in `read_task` and in what
  `remove_task_dependency` answers; `assignee: "unassigned"` and `"agent"` filtered, and aspects
  matched on any; an external caller's results carrying addresses, by its id for an organization
  without a slug, and the agent's none; no write recording an `ActivityDay`.
- Verify: with `bun run mcp:tasks` added to Claude Code locally and the board open in a tab, have
  it read the board, create three tasks for a plan, link them in order, assign one to a teammate and
  one to Strategy Dance, and move one to Done, the cards arriving without a reload; save a
  description in the task's dialog while Claude Code rewrites it from an older read, and see its
  write refused; delete a task and restore it.
- Built with these settled, on 2026-10-10:
  - **One fake for every module.** A module's handler loads every module's server, and Bun refuses a
    test whose mock lacks a name any of them imports (`Export named … not found`), so
    `createModuleDatabaseFake` puts a base, the memberships, the call results and their operations,
    together with `createKnowledgeDatabaseFake` and `createTasksDatabaseFake`. The test kit,
    `createModuleTestKit(name, caller)`, the write tools' check, `readModuleWriteCall`, the web
    addresses, `createModuleAddresses`, the schema helpers and `isOperationRefusal` are the frame's,
    shared rather than copied.
  - **`has()` sees a variable sent as null**: `UpdateTaskForAgent` refuses `name: null`, and an
    omitted variable leaves its column alone while a null one clears it, checked against the
    emulator. `GetTasks` refreshes on an update unless it carries a description alone,
    `!has(description) || has(<a card's field>)`, which holds whichever way a cleared due date reads.
  - **A check under an empty list speaks first.** With the membership gone, the variables' checks
    nested under it are never invoked, and Data Connect refused a removed member's write with the
    idempotency key's message. Marked `optional: true`, they leave the refusal to the membership's
    own check. Knowledge's writes share the shape and reach the right answer through
    `explainKnowledgeDocumentRefusal`'s second read; `CLAUDE.md` records the rule.
  - **The board is read whole.** Every tool reads the live board, at most 1000 tasks without their
    descriptions, and filters, orders, pages, places and checks loops in memory, on core's helpers;
    only a query's pattern runs in SQL, one substring on the name or the plain text, never split
    into words, as the board's own search matches.
  - **The board's order** compares an instant to the microsecond however many digits Data Connect
    wrote its fraction with, and an id as Postgres orders a UUID, so a cursor holding the last task's
    status, position, instant and id resumes exactly.
  - **Answers read back.** An assignee is answered as `"member:<id>"`, `"agent"` or `"unassigned"`,
    with `assigneeName`, the values the tools take; a task's links come as `dependsOn` and
    `waitedOnBy`, each `{ tasks, count }`, and a move to Done as `canStartNow`. A replaced
    description answers its new `version`, a hash of the description as stored.
  - **A restore blocked by a loop names the tasks waiting on the deleted one** whose links would close
    it, as the page's `getTaskRestoreLoops` finds them, and `remove_task_dependency` takes a link to a
    deleted task, so the model can take one off before restoring. A link already there is written
    again as an upsert, so its key is kept, and answered `isNew: false`.
  - **Budgets count addresses**: a page of `list_tasks` and a `read_task` count each task's web
    address, which an external caller's results carry, within 40000 and 45000 characters.
  - **"50 tasks it waits on and 999 waiting on it" is 1050 tasks**, past `MAX_TASKS` and past what
    the board read holds, so the read test has 50 and 949, the whole board; the freed tasks test has
    the 999 of a board of 1000.
  - **`check:tasks-module` is the backend package's**, as `check:knowledge-module` is: the Commands
    row for `mcp:tasks` names it rather than a root command. A list variable holds at most 100 rows,
    so the script fills a board in hundreds.
  - Verified with `bun run check:tasks-module` and `bun run check:knowledge-module` against an
    emulator of the branch's schema, every check passing; with the SDK's stdio client, a 2025 one as
    Claude Code's is, driving `mcp:tasks` through every tool; in the browser at 1280 and 390 wide, the
    board open while the module created three tasks, linked them, refused the link closing a loop,
    assigned one to a teammate and one to Strategy Dance, moved one to Done, answering the task it
    freed, cleared a due date, deleted one and restored it, every change arriving without a reload;
    a description saved in the task's dialog storing its plain text, and the module's write from an
    older read refused; a task created on the page storing its plain text; and the backfill over 250
    unindexed tasks, run again with nothing left. Not seen from Claude Code itself, which
    `claude mcp add strategydance-tasks-local -- bun run mcp:tasks <email>` connects.

### M16: Knowledge in conversations

The agent's knowledge, through the module, in process (see Modules § Strategy Dance's agent).

- The worker's module client: for each run, the server of each module the agent uses, the Knowledge
  module's alone until M17, for the run's member (`kind: 'agent'`, every scope, the run's
  `membershipCreatedAt`, the scope `conversation:<id>`), an SDK `Client` pinned to the 2026-07-28
  revision and connected to the module's handler through a transport whose `fetch` is `(url, init)
  => handler.fetch(new Request(url, init), { authInfo })`, the caller as `authInfo`, and its tools
  converted and appended after the built-in ones. Reads run four at a time, writes alone, each keyed
  with its `tool_use` id.
- Recovery as A run § Recovery and side effects says: a worker taking over, and Resume, call a
  module write again with its key; finalizing an interrupted run, and a send answering it, read
  each started write's key first, recording a stored result as `SUCCEEDED` and answering the rest
  as interrupted calls that may have run. The conversation prune deletes its `ModuleCallResult`
  rows by their scope.
- The tools' labels in the `conversation` catalogue, running and done, and `bun run translate`;
  the system prompt's knowledge section.
- In the thread, `doc:` links resolve against the organization's live document list: the current
  title, or, for an id the list does not hold, since it leaves deleted documents out, the title the
  agent wrote, struck through, whether the document was deleted, pruned or never there. A
  `delete_document` row offers Restore, through `RestoreDocument`, while the list does not hold the
  document and a day has not passed since the call.
- Tests (scripted client, database mocked): the client connecting with no `initialize` handshake;
  the converted tools list's bytes pinned, every name in it, built-in or a module's, unique,
  `minLength` and its kin dropped, `strict` and eager input streaming set; a module write sent with
  its `tool_use` id as its key; a crash between the module's write and the worker recording it, the
  next worker calling again and the write landing once, `append` included; a worker fenced out
  during a call landing its write, and the worker that took over answered with its result; an
  interrupted run's started write found by its key and drawn `SUCCEEDED`, and one not found answered
  as interrupted and may have run, by the next send too; a Resume after the write had landed
  answered from its key; a Retry writing anew under new keys; a module's `isError` sent as
  `is_error`; consecutive reads running four at a time and writes alone, in order; the conversation
  prune deleting its rows.
- Verify: with a document open in another tab, ask the agent to write a decision into it and watch
  the edit arrive without a reload while you type elsewhere in it, your caret staying put; ask it
  to create one and tag it; open both in Knowledge; ask it to delete one and restore it from the
  thread's row; turn Write off on one and ask again; turn Read off on it and ask about it; kill the
  local backend during a write and resume.
- Built with these settled, on 2026-10-11:
  - **A strict request has limits beyond keywords.** Claude takes at most 20 strict tools, 24
    optional parameters and 16 union ones across a request, beside refusing `minLength`,
    `maxLength`, `minimum`, `maximum`, `multipleOf`, `maxItems` and a `minItems` past one. The
    conversion (`toConversationModuleTool`) drops those, drops `$schema`, closes every object, which
    zod's input schemas leave open, and throws on anything else a strict schema refuses.
  - **And a grammar too complex.** With the patterns kept, the document's id on five tools and the
    one-line title's, `probe:claude` found the API refusing the agent's request, "Schema is too
    complex", within every published limit. The conversion drops `pattern` too, the module's zod
    still refusing what breaks one, and the API then compiled the list in some 20 seconds, once,
    and served it from its cache in under two after. `buildConversationTools.test.ts` pins the list's bytes and counts the limits: Knowledge
    holds 11 optional parameters and no union. The Tasks module's input schemas would add about 17
    more, past 24, which M17 settles (see Risks).
  - **The tools are listed per run**, through the module's handler once the run is claimed, and the
    request's list is `buildConversationTools`: the agent's own, then the modules'. The system prompt's
    and tools' share of a request is counted once for each list. A run that cannot connect is left to
    its lease, so Cloud Tasks redelivers it.
  - **A worker past its lease still passes its fence**, which matches the run's status, attempt and
    membership, never its lease, until its run is finalized. So a started write is settled from its
    key only once the run has let go of the conversation: right after `InterruptDeadConversationRun`,
    and by a send or a continuation, `SettleConversationToolCall` refusing while `activeRunId` is set.
    The settle matches the stored row's tool, member and organization, never the arguments' hash,
    since the key is Claude's id for that one call and a module's schema may normalize what it was
    sent (the Tasks module trims a name).
  - **The stored result is the answer**: a module stores the result its tool answers an agent caller,
    which carries no address, so `toToolOutput` of the stored row is the bytes the live call would
    have sent Claude.
  - **A write past its 60 seconds may still land**, the module's mutation going on once the client
    gives up, so it is answered "The call took longer than 60 seconds and may still have run. Check
    before you call it again." The module client's own request timeout sits past the run's.
  - **The sweep is the only prune**, as David chose: `StartConversation` deleted the member's
    conversations past a day directly, which could not reach their `ModuleCallResult` rows, found by
    their scope alone. It now leaves them to the sweep, which deletes each batch's results by their
    scope (`DeleteConversationModuleCallResults`) before the conversations, and `RestoreConversation`
    refuses one deleted over a day ago in its `where`, whether or not the sweep has run. Being the
    only prune, the sweep deletes batches for up to five minutes rather than fifty batches of
    twenty, which capped it at a thousand conversations a day.
  - **The conversations' fake holds the modules'** as `modules`, its SDK spread under its own and a
    member added to both with one `createdAt`, so every test of the worker loads the real module
    servers; `connectTestModules(runners)` brings a test's own runners in.
  - **The thread reads the documents only when it needs them**: once a reply's text holds `doc:` or a
    `delete_document` row is drawn. A link draws the agent's words, unlinked and not struck, until
    the list lands. A `delete_document` row reads the call's output once, which holds the id and
    `restorableUntil`, rather than the input, since neither the tail nor the bodies carry a call's
    input. On a phone, a row with an action of its own hides its "Tool" badge and lets its label wrap.
  - **The labels** of the tools the plan dropped on 2026-10-10 went from the catalogue; the
    Knowledge tools' running labels kept the ids the plan's earlier names had.
  - **`probe:claude` sends the agent's own request** with its full tools list, which the API refuses
    whole when a strict schema is one it does not take, or too complex. Run on 2026-10-11, every
    check passing once the patterns were dropped.
  - Verified with the tests; `check:conversation-runs`, `check:conversation-list` and
    `check:knowledge-module` against an emulator of the branch's schema, every check passing; and in
    the browser at 1280 and 390 wide, the backend's Claude client swapped for a scripted one: a
    document created through the module, its `doc:` link drawn with its title, a dead link struck
    through, a delete striking both through and offering Restore, which brought it back and took
    itself away, an append arriving in the document open in another tab while the member typed in
    it, Write then Read turned off and refused, and the backend killed while a write that had landed
    was held, the interrupted run's call drawn `SUCCEEDED` from its key, and Resume carrying on with
    the text appended once. The real model was asked through `probe:claude` alone, not through a
    conversation in the browser.

### M17: Tasks in conversations

The agent's tasks, through the Tasks module, in process, as M16 reaches Knowledge.

- The worker's module client takes the Tasks module beside Knowledge: its tools converted and
  appended after Knowledge's, in `MODULES`' order, `list_tasks` and `read_task` running four at a
  time with the other reads and the writes alone, each keyed with its `tool_use` id. Recovery is
  M16's, for every module.
- The tools' labels in the `conversation` catalogue, running and done, and `bun run translate`; the
  system prompt's tasks paragraph, with "cannot change tasks" gone from it (see The agent).
- `task:` links: the design system's `Markdown` lets `task:` through beside `doc:`, for `renderLink`
  to draw, and the thread resolves them against the organization's live board, `GetTasks`, read only
  once a reply holds one or the thread draws a `delete_task` row, which reads it too: the task's
  current name with a task icon, opening the task in its dialog over the board, or, for an id the
  board does not hold, since `GetTasks` leaves deleted tasks out, the name the agent wrote, struck
  through, whether the task was deleted, pruned or never there. No query is added. `CLAUDE.md`'s
  line on `Markdown` says so.
- A `delete_task` row offers Restore while the board does not hold the task and a day has not
  passed since the call, through the board's own restore rather than `RestoreTask` alone: the
  task restored, the board read again and each link closing a loop removed, as the page's Undo
  does, and the day recorded through `recordActivity`, as every member's change to the board is.
- The tools list then holds sixteen module tools: the pull request records what the converted list
  costs a cached request, so whether Claude's tool search (`defer_loading`) should keep some of
  them out is decided on that figure, which is David's call.
- Tests (scripted client, database mocked): the converted list's bytes pinned again, every name in
  it unique; a crash between a `create_task` and the worker recording it, the next worker calling
  again and one task made; consecutive `list_tasks`, `read_task` and `search_documents` calls
  running four at a time, and writes alone, in order; `Markdown` keeping a `task:` link and still
  dropping a `javascript:` one; a `task:` link whose id the board does not hold, a deleted task's
  and an unknown one alike, drawn struck through with the name the agent wrote, and drawn again with
  the task's current name once it is restored; a `delete_task` row in a reply that links no task
  reading the board itself, offering Restore while the task is off it and hiding it once the task is
  back; a Restore from a row whose task's kept links, with one made while it was deleted, close a
  loop, leaving no loop on the board, and recording the day.
- Verify: with the board open in another tab, talk a launch through and ask the agent to turn the
  plan into tasks, linked in order and assigned, and watch the cards arrive without a reload; ask it
  to mark one done and hear which can start; open a task from a link in its reply; ask it to delete
  one and restore it from the thread's row; assign a task to Strategy Dance on the board, then ask
  the agent what it has been given.
- Built with these settled, on 2026-10-11:
  - **The modules' tools are not strict**, as David chose. A request takes at most 20 strict tools,
    24 optional parameters and 16 union ones, and adding the Tasks module would have made 17 strict
    tools and 28 optional parameters, Knowledge's 11 and the Tasks module's 17, `update_task` alone
    8: the next module would break the 20 tools whatever its schemas. Strict only holds how Claude
    writes a call, and the module's own zod checks every call anyway, as it checks an external
    agent's, which never gets a strict grammar. So every module's tools, Knowledge's included, go
    as the module wrote their schemas, less the `$schema` dialect, bounds, patterns and formats
    kept, so Claude reads the real ones, and no grammar is compiled for them; `ask_user` alone stays
    strict, and `buildConversationTools.test.ts` holds the strict tools to the limits. M17 changed
    the list anyway, so dropping `strict` cost conversations their earlier reasoning no more than
    once. `probe:claude` has Claude call `list_tasks` through the whole list, which it did with
    `{ "status": "TODO" }`.
  - **What the tools cost a cached request**, which `probe:claude` now counts with `count_tokens`:
    the system prompt and the agent's own tools take 7201 tokens, and the modules' sixteen tools
    7381 more, Knowledge's 3158 and the Tasks module's 4223,
    `update_task` the largest at 1187, then `create_task` at 857, `update_document` at 814 and
    `list_tasks` at 723. The agent's request cached 14596 tokens on its first send and read all of
    them from the cache on its second. At Opus 5.5's prices the modules' tools cost a request read
    from the cache $0.0015, the Tasks module's $0.0008, and a write to the 5-minute cache $0.037.
    Claude's tool search pays once tool definitions pass some 10000 tokens, so at 7381 it would
    cost each first use of a module tool a search step for little: whether to keep some out with
    `defer_loading` is David's call on these figures, sooner when a third module takes the modules'
    share past 10000.
  - **The board's own restore, by id.** The board's Undo restores from a snapshot it took before
    the delete, which the page never took of the agent's, so `useTaskChanges` gains
    `restoreDeletedTask`: `RestoreTask` through `change`, which marks the day active, then the board
    read again from the server and each link of a task waiting on the restored one that closes a
    loop through it taken off (`restoreTaskWithoutLoops`), which the Undo's second read now goes
    through too. Without the snapshot nothing is written to the board before the server answers, so
    a loop can show on the board for the moment between the restore and the unlinking, as one a
    teammate's link closes can after the Undo.
  - **One read for both kinds of delete.** A `delete_task` call answers `{ id, restorableUntil }`,
    as `delete_document` does, so the thread reads the outputs of both in one
    `GetConversationToolOutputs` read (`useConversationDeletedItems`), and decides what a row offers
    with `canRestoreConversationItem` against the live list of its kind.
  - **A row passes its action only while Restore shows.** M16's rows passed it whenever a delete
    succeeded, so a phone hid the "Tool" badge of a row whose Restore had gone; the thread now
    decides, and passes nothing otherwise, a document's row included.
  - **A task link resolves as a document link does** (`readConversationLinkTarget`): found, gone or
    the agent's words, `ConversationDocumentLink` and `ConversationTaskLink` drawing each, the
    latter with the board's `SquareKanbanIcon`, linking to `/$organizationSlug/tasks/$taskId` with
    the board's id, which `TaskBouncer` compares exactly.
  - **The system prompt** says what the agent does with the board and drops "its members" from what
    it cannot read, since `list_tasks` lists them: it still cannot read the log, the checklist or
    anybody's top priority.
  - Verified with the tests; `probe:claude`, every check passing; and in the browser at 1280 and 390
    wide, on a scratch stack of the branch's emulators, the backend's Claude client swapped for a
    scripted one: with the board open in another tab, three tasks created, linked in order and
    assigned, the cards arriving without a reload; a move to Done answering the task it freed; a
    `task:` link opening the task's dialog over the board; a link to a task never there struck
    through; a delete striking the task's links through and offering Restore; a link made while it
    was deleted closing a loop, which Restore took off, keeping the others, recording the day and
    taking itself away, the links drawn again with the task's name; the phone's "Tool" badge hidden
    only while Restore showed; and a task assigned to Strategy Dance found through `list_tasks`. The
    real model was asked through `probe:claude` alone.

### M18: The authorization server

Strategy Dance's OAuth server on the public backend, as Modules § External agents describes it,
with nothing to authorize yet but a script: the consent page comes in M19 and the endpoint in M20.

- The tables, as Modules § The data lists them: `OAuthClient`, `OAuthAuthorizationRequest`,
  `AgentConnection` and `AgentConnectionToken`, its hashes `@unique`. `AgentConnection`'s
  reference to the member's `UserOrganization` row is the schema's first to that table: check the
  fields the generator writes for its composite key in the emulator before anything names them, and
  comment why this table breaks the convention.
- Backend-connector operations for all of it. Those that find a request, a code or a token by its
  id or its hash run before any `$userId` is verified, which `CLAUDE.md` § The database records as
  an exception beside the sign-in screen's public lookup.
- `routes/oauth.ts`, mounted at `/oauth`, and the metadata at
  `/.well-known/oauth-authorization-server`, on the public backend only, with what they do in
  `domain/oauth/`: the metadata, `POST /oauth/register`, `GET /oauth/authorize`, `POST
  /oauth/token`, `POST /oauth/revoke`, and the consent page's `GET /oauth/requests/:requestId`,
  `POST …/approve` and `POST …/deny`, which take the member's ID token and App Check and check
  `ARE_MODULES_STAFF_ONLY`, a new constant in strategydance-core. Client ID metadata documents are
  fetched through `fetchOutbound`, and only when a signed-in member's consent page reads the
  request, which is also when such a client's redirect address is checked. Registering and
  authorizing are rate-limited per address, and registrations capped in all.
- The token verifier M20 mounts: one read by the token's hash, of an unexpired access token alone,
  with its connection, its membership and the account's staff role, compared with the endpoint's
  resource. The refresh grant likewise takes a refresh token alone, and derives its successors under
  `oauth-token-secret` (setup step 10), read by version: `retrieveSecret` gains a version argument,
  kept per version, beside its latest.
- The daily sweeper deletes expired authorization requests and tokens, and registrations over a day
  old that no connection uses.
- `bun run check:oauth`, under the backend's `scripts/`, runs the flow against the local backend
  and the emulators: it registers a loopback client, authorizes, approves as an account signed in
  to the Auth emulator, exchanges the code, refreshes, presents the spent refresh token again, and
  revokes.
- `CLAUDE.md` § Backend conventions: the protocol's own OAuth endpoints, the metadata, `register`,
  `authorize`, `token` and `revoke`, answer in OAuth's own JSON rather than `ApiResponse`, carry no
  App Check, answer any origin without credentials, and find tokens by their hash; the consent
  page's `requests` routes keep the app's middleware, its ID token and App Check, as every route the
  app calls does.
- Tests (database mocked, `fetchOutbound` faked): no outbound fetch before a member has signed in,
  an authorization request naming a client ID metadata document fetching nothing until the consent
  page reads it; the metadata exactly as Modules lists it, every field RFC 8414 requires included; a
  client ID metadata document fetched and kept, and refused when its `client_id` differs from its
  address, when its body was cut, when it redirects, when it is not valid JSON or lacks `client_id`,
  `client_name` or `redirect_uris`, when the client ID has no path, and when it declares a token
  endpoint authentication other than `none` or none at all; any parameter repeated in an
  authorization or a token request refused, `state` and `code_verifier` among them; a registration
  with an `https` redirect or a private-use one such as `cursor://` refused, and a loopback one
  accepted; a loopback redirect matching on any port, and every other one exactly; an error before
  the client is checked rendered and never redirected, and one after it redirected with `state` and
  `iss`; a success redirected with `code`, `state` and the exact `iss`; `resource` missing, repeated
  or naming no module refused, scopes past the module's refused, and the write scope without the
  read one refused; approving read and write for a client that asked for read refused, and a request
  for read and write reduced to read, its token answer's `scope` saying read alone; a token request
  missing `resource`, or naming another than its code's or its refresh token's, refused; an exchange
  missing its `client_id` or its `redirect_uri`, or naming another client or address than its
  code's, refused, and a refresh from another client than its token's refused; a `plain` challenge
  and a wrong verifier refused; a code used twice refused, the second use revoking the connection
  with all its tokens, after the first use's refresh token has rotated too, and a code past its
  minute refused; a token for one module refused for another; a refresh rotating; the spent token
  presented again within 30 seconds answered with the very pair its first use issued, however many
  times and in whichever order the answers return, and presented after 30 seconds revoking the
  connection; the two successors of one spent token differing; a duplicate across a rotation of the
  secret, served by an instance holding the newer version, answered with the first use's pair;
  consenting again replacing the earlier connection and its tokens, and two approvals at once for
  one client, organization and module leaving one connection; Allow sent twice making one connection
  and one code, an Allow racing a Deny deciding the request once, and a denied request refused by a
  later Allow; a code presented again leaving another connection's tokens alone; approving refused
  for an account that is not staff and for an organization it is not in; removing the member
  deleting the connection with its tokens; a revoked token refused; an access token presented to the
  refresh grant refused, and a refresh token to the verifier; every token answer carrying
  `Cache-Control: no-store` and `Pragma: no-cache`; `response_type` missing, repeated or other than
  `code` refused; `grant_type` missing, repeated or unknown refused, and a code exchange carrying a
  refresh token's parameters reading none of them; a revocation naming another client than the
  token's refused, the connection left as it was.
- Verify: `bun run check:oauth` against the local stack; `/security-review` on the branch before it
  merges, as Risks asks.
- Built with these settled, on 2026-10-11:
  - **The membership's columns are named.** Data Connect refuses a reference to a key made of
    references, so `UserOrganization` names `userId` and `organizationId` beside its references,
    as Data Connect named them anyway, and `AgentConnection.membership` references the two with
    `@ref`, its constraint named `agent_connection_membership_fkey`, short of Postgres' 63 bytes.
    The emulator's migration from `dev`'s schema only creates the new tables and their indexes,
    and touches `user_organization` not at all.
  - **Allow decides the request last.** The request references the connection Allow inserts, so
    Allow locks the membership, deletes the earlier connection for that client and module, inserts
    the new one, then decides the request under `@check(this == 1)`, which rolls the whole mutation
    back when it refuses. `check:oauth` showed on the emulator, before any backend code, that
    consenting again, two consents at once for one client, organization and module, Allow sent
    twice and an Allow racing a Deny each leave one connection and decide once. Data Connect
    reports the insert's foreign key before the lock's check, so a caller who is not the member is
    refused by either message, which `isMembershipRefusal` reads as one. The update also matches
    the request's client and resource, and `includesAll` the scopes granted, so the database
    itself grants nothing the request did not ask for.
  - **A registered client is marked used by an operation of its own**, `RecordOAuthClientUse`:
    a step skipped by `@include` still refuses a null key, so it could not ride in the request's
    insert for a client ID metadata document's request.
  - **The protocol's endpoints answer any origin** through the app's `cors`, which takes an options
    delegate matching `OAUTH_PROTOCOL_PATHS` exactly, as Express routes them, ignoring case and one
    trailing slash, never by prefix, so the consent page's routes under `/oauth/requests`, a router
    of their own mounted ahead of the protocol's, keep the app's origins. The protocol's router
    answers its own errors in OAuth's JSON.
  - **The metadata names `revocation_endpoint_auth_methods_supported: ["none"]`** beside the token
    endpoint's, since a field left out means `client_secret_basic`.
  - **Bounds before anybody signs in**: registration 20 an hour per address and 1000 a day in all,
    authorization 60 in ten minutes per address and 1000 in ten minutes in all, each a count under
    `@check` rather than a lock, so a few at once can pass the cap by as many; the consent routes 60
    in ten minutes per member, as link previews, since reading a request is what fetches a client's
    document. A client's id, its redirect address and `state` are held to 2048 characters, `state`
    before any redirect, so an oversized one is never sent back.
  - **A registered `client_id` is exactly what registration answered**, 32 lowercase hex digits,
    checked before any read, so two spellings of one client never make two connections. A redirect
    address's own query is kept byte for byte, the answer appended to it, and one already naming
    `code`, `state`, `iss` or `error` is refused.
  - **A code presented again revokes its connection whoever presents it**, before its client,
    redirect or verifier are compared, as RFC 6749 asks. A refresh token's duplicate within 30
    seconds is answered only while both successors are still stored on its connection, so it never
    hands out one revoked since.
  - **Revoking a refresh token ends the connection; an access token, itself alone.**
  - **A refresh may narrow its access token.** Each token carries its scopes: a refresh naming fewer
    than its token holds, never others, issues an access token holding those alone, its refresh
    token keeping its own (RFC 6749, 6), and the verifier reads the access token's. The rotation
    checks both against the spent token's in the database, and the exchange against the
    connection's.
  - **A registered client is marked used before its request is stored**, so the daily sweep never
    prunes a client an authorization is naming, and one pruned since it was read stores nothing.
  - **The consent routes are metered before the staff check**, so a caller who is not staff is
    counted too, and **the token and revocation endpoints per address**, 600 and 300 in ten
    minutes, generous since a hosted client, claude.ai or ChatGPT, calls them for every member from
    a few addresses of its own: the launch revisits them. A connection's rows are bounded by their
    expiry rather than a cap, which would stop a client that refreshes often.
  - **A delayed duplicate follows the chain.** A spent refresh token presented again within its 30
    seconds after the client rotated its successor in turn is answered with the pair whose refresh
    token is unspent, up to 30 rotations, never a spent one the client's next refresh would replay.
  - **A connection gone meanwhile is a revoked grant.** A consent replacing it, a revocation or the
    member's removal landing between a read and an exchange or a rotation makes the new tokens'
    reference fail, which the emulator reports, as `agent_connection_token_connection_id_fkey`,
    before the step's check: `isConnectionGoneRefusal` answers it `invalid_grant`, never
    `server_error`.
  - **Addresses are refused for a space or a control character** before they are parsed, a redirect
    address and a resource alike, since the URL parser strips them silently.
  - **The modules' gate lifts on the development backend** (`IS_MODULES_RELEASE_GATED`), as
    conversations' does, so `check:oauth` and a developer's client need no staff role locally.
  - **`OAUTH_ISSUER` honours `API_URL` in development**, so a worktree's backend on another port
    names itself, as `check:oauth` reaches it.
  - **`retrieveSecret` reads by version** through `retrieveSecretVersion`, which says which version
    the latest was. An instance keeps the latest it read for its life, so Setup 10 now keeps the
    previous version enabled until a deploy has replaced every instance, and a day at least.
  - Verified with the tests, every item of the list above among them, and `check:oauth` against a
    scratch suite of the branch's Auth and Data Connect emulators and the branch's backend on its own
    port: the whole flow over HTTP, the verifier taking the access token and refusing it for the
    Tasks module and the refresh token, then every operation's condition and race.

### M19: The consent page and Connected agents

- The `module` message type, for the consent page, Connected agents and M20's dialog, its module
  and its `MESSAGE_TYPES` entry, registered on the consent page's route and in `_app.tsx`'s
  `APP_MESSAGE_TYPES`, and `bun run translate`.
- `/oauth/consent`, as Modules describes it: under `_authenticated` and outside `_app`'s frame, so a
  signed-out member signs in and comes back through the page `AuthenticationBouncer` keeps; read
  through `GET /oauth/requests/:requestId`; the client, the module, an organization chosen among the
  member's, the access, read and write offered only when the client asked for both, Allow and Deny,
  the module and its access worded from the `module` catalogue by the module's name, for every
  module `MODULES` lists, Tasks included, since a client can ask for it from here; an expired or
  unknown request's state; an account that is not staff told the page is not available yet.
  `firebase.json` sends `frame-ancestors 'none'` for `/oauth/**`.
- The account page's Connected agents tab, staff only: `GetAgentConnections`, live, the caller's own
  connections, refreshed by approving, disconnecting and `RemoveOrganizationMember` on
  `mutation.variables.userId == request.auth.uid`, which for a removal is the member removed, and by
  `DeleteOrganization` with no condition, since its `$userId` is the administrator deleting it and
  every member's connections go with it, a rare enough event to refresh everybody; never by the
  `lastUsedAt` write, each with its client, organization, module, access, and when it connected and
  was last used; and Disconnect, `DeleteAgentConnection`, which deletes it with its tokens.
- Verify: `check:oauth`'s flow with the page approving in a browser instead of the script, at
  desktop and phone widths; signed out first, the page coming back after signing in; Deny; an
  expired request; a connection disconnected from the tab, and the script's next refresh refused.
- Built with these settled, on 2026-10-11:
  - **The consent address carries the request's id hyphenated.** TanStack parses each value of a
    query as JSON first, so 32 hex digits that happen to be decimal, or decimal around one `e`,
    about one request in a million, would arrive as a number that lost its digits. The backend
    writes it with `toHyphenatedUuid`, which never parses, and the page's `validateSearch` takes a
    string alone.
  - **The page reads its request once**: no retry, no read on focus or reconnecting, never stale. A
    read is what has the backend fetch a client's metadata document, metered per member, and a read
    after deciding would answer that the request is gone while the browser leaves for the agent.
  - **The gate is a screen, not a redirect, and comes before the read**: an account that is not
    staff is told the page is not available yet, since an agent sent it there, and the backend
    fetches no document for it. The web's `useCanUseModules` keys off `ARE_MODULES_STAFF_ONLY` and
    `EMULATORS_REQUESTED`, as `useCanUseConversations` does.
  - **Either answer replaces the page** (`window.location.replace`), so going back never lands on a
    request decided. A request expired or gone meanwhile, and an agent that could not be verified,
    end the page with their own words, never the backend's English; anything else is a toast and
    another try. A Deny answered with no address, the agent unverified, says the connection was
    denied and the page may be closed.
  - **The organization defaults to the one the member has open**, among their own, and a member in
    none is told so on the page with a way to the prologue, since `_app`'s bouncer is not above it.
    Deny stays offered.
  - **Read and write is offered checked when asked for**, and Read alone, unchecked, beside it, each
    worded by the module: the consent never grants more than was asked, and the member reduces it.
  - **The frame header is a case-insensitive regex**, `(?i)^/oauth(/.*)?$`, since the router matches
    paths regardless of case and `/OAuth/consent` would otherwise render unguarded. It sends
    `X-Frame-Options: DENY` beside `frame-ancestors 'none'`, for browsers without CSP 3.
  - **`DeleteAgentConnection` deletes by id and `auth.uid`**, so another member's id deletes nothing,
    and one gone already succeeds, as `DeleteConversation` does. `$userId` checked against the token
    is what the list's refresh condition reads. A revocation or a reused code, which the protocol's
    endpoints make knowing no `$userId`, shows on the tab's next read, as the page regains focus.
  - **Disconnect asks twice through the button**, without a dialog: a consent from the agent undoes
    it.
  - **A member connects at most 100 agents** (`MAX_AGENT_CONNECTIONS`), so the tab, which reads
    every one, is the whole list and Disconnect reaches each, as `MAX_CONVERSATIONS` bounds the
    conversations list. Allow first writes the member's own row, a lock their consents in every
    organization take in turn, then the membership, so the count after both is exact, and leaves out
    the connection it replaces, so consenting again at the cap goes through. Nothing else writes a
    user row and a membership both, so the order waits on nobody. Past the cap it answers
    `TOO_MANY_AGENT_CONNECTIONS`, deciding nothing: the page warns, links to the tab in a new one,
    and lets the member allow again. The list reads exactly 100. The emulator's PGlite runs one
    transaction at a time, so `check:oauth`'s race of two organizations passes with the lock or
    without it: it guards the outcome, and Postgres' row lock is what makes it hold.
  - **`check:oauth` makes its tokens for the backend's own issuer**, `API_URL`, so it runs against a
    backend on another port, and checks the list and Disconnect through the web connector as two
    members of one organization.
  - Verified with the tests, `check:oauth`, and a browser driving the page and the tab against a
    scratch suite of the branch's Auth and Data Connect emulators and its backend on its own port:
    signed out first and back after signing in, Allow for another organization with read alone, the
    token answer saying read, Deny at phone width, an expired, an unknown and a malformed request,
    the tab listing a connection, another appearing live, Disconnect removing it without a reload,
    and the agent's next refresh refused. The page's not-available screen can only be seen against
    the real project, since the emulators lift the gate.

### M20: The Knowledge module for external agents

- Dependencies: `@modelcontextprotocol/node`, for `toNodeHandler`, and
  `@modelcontextprotocol/express`, for `requireBearerAuth` and `mcpAuthMetadataRouter`.
- `routes/modules.ts`, mounted at `/mcp` on the public backend only: `POST /mcp/knowledge` through
  the module's handler from M14, mounted with `toNodeHandler` and handed the parsed body as its
  third argument, `(request, response) => nodeHandler(request, response, request.body)`, behind
  `requireBearerAuth` with M18's verifier and the endpoint's address as `expectedResource`; the
  `Origin` check; a 1 MiB body; `moduleRateLimitMiddleware`, per connection; 405 on GET and DELETE.
  `/.well-known/oauth-protected-resource/mcp/knowledge` is served through `mcpAuthMetadataRouter`
  mounted at the app's root, beside the authorization server's metadata, never under `/mcp`, where
  it would answer at `/mcp/.well-known/…` rather than the address the 401 names. The caller comes
  from the token (`kind: 'external'`, the connection's scopes, the scope `connection:<id>`), so a
  read-only connection's write calls are challenged; `lastUsedAt` is written at most once a minute;
  an external `search_documents` draws on the member's `ConversationSearch` allowance.
- The Knowledge page's "Use with your agents" button and dialog, staff only.
- `CLAUDE.md`: the Modules section gains the endpoint, how an external agent is authorized, and what
  a new module needs; § Backend conventions, that `/mcp` answers JSON-RPC rather than `ApiResponse`
  and carries no App Check.
- Tests: no token answered 401, its `WWW-Authenticate` naming the metadata; a valid access token
  accepted, its `AuthInfo` carrying the row's `expiresAt` and `resource`; a token for another
  resource, a revoked one, a removed member's and a refresh token presented as a bearer token
  refused; a read-only connection's `tools/list` holding every tool, and its direct `tools/call` of
  `create_document` answered 403 with `insufficient_scope`, naming `knowledge:write` and the
  resource metadata, nothing written, and a new consent for read and write replacing the connection
  with one that may write; a write retried with its key applied once; an `Origin` from elsewhere
  answered 403, and a request with none served; a POST's JSON body reaching the handler whole
  through the route's parser; a 2025-11-25 client's `initialize` and session header served
  statelessly; a search past the allowance answered with a result saying so.
- Verify: locally, add `http://localhost:3003/mcp/knowledge` to Claude Code (`claude mcp add
  --transport http`), consent, and run every tool against a document open in a tab, then the MCP
  Inspector; in production, as staff, add the module to claude.ai as a custom connector (which takes
  the client ID metadata document), to ChatGPT in developer mode and to Cursor (which registers:
  should it insist on a `cursor://` redirect, which the specification rules out, accepting it, a
  deviation PKCE mitigates, is David's call), use it from each, and disconnect one from Connected
  agents and see its next call refused.
- Built with these settled, on 2026-10-11:
  - **The adapters are `@modelcontextprotocol/node` 2.1.1 and `@modelcontextprotocol/express`
    2.0.2**, the latest past the cooldown, both peers of the 2.3.0 server installed.
  - **Any method but `POST` answers 405 before any check**, since the handler is stateless: it opens
    no stream to `GET` and holds no session to `DELETE`. Then the `Origin` check, the bearer check,
    the connection's rate limit and the body, in that order, so nobody unverified has a megabyte
    parsed.
  - **The `Origin` check is the SDK's `originValidation`, by hostname**: the app's, `strategydance.com`
    in production and `localhost` in development. A request without one passes, as clients outside a
    browser send none.
  - **A connection makes 600 calls in ten minutes**, counted in the instance's memory and keyed by
    the connection, as generous as the token endpoint, a 429 in JSON-RPC past it. The launch
    revisits it with the others.
  - **An address makes 600 refused calls in ten minutes**, metered before the bearer check, as the
    first review round asked: the connection's limit runs only once a token is read, so a made-up
    token, or a call past a connection's limit, would otherwise cost a read of the database each.
    Only an answer of 400 or above counts, so a hosted client calling for many members from a few
    addresses is held by each connection's limit alone.
  - **The use recorder forgets its oldest write once it holds 10000 connections**, in one step, as
    the first review round asked: its sweep of entries over a minute old freed nothing when all were
    younger. A connection forgotten within its minute is only asked of the database again.
  - **The resource metadata answers any origin**, its path joining `OAUTH_PROTOCOL_PATHS`, so a
    client running in a page discovers the server as it discovers the authorization server; the
    endpoint keeps to the app's origins. `mcpAuthMetadataRouter` serves the authorization server's
    metadata too, which `routes/wellKnown.ts`, mounted before it, answers first, both from
    `buildAuthorizationServerMetadata`.
  - **A client of a 2025 revision is answered over SSE.** The SDK's stateless fallback streams its
    answers whatever `responseMode` says, which those clients read; the 2026-07-28 revision's are
    JSON. Its `initialize` and a session header it sends after are served statelessly.
  - **`lastUsedAt` is written as a token passes the verifier**, once a minute at most: a recorder in
    each instance remembers when it last wrote each connection, and `RecordAgentConnectionUse`'s
    condition, which matches the member's account too, holds the minute across instances. A write
    that fails is logged and fails no call.
  - **The challenge makes the tool's own scope check a second guard**: `requireScopes` reads the
    `AuthInfo`'s scopes, which are the caller's, so the tool's refusal is unreachable through the
    handler and is tested on its own. Only the Knowledge module's writes are challenged, the Tasks
    module's joining in M21, and the tools the agent is sent did not change by a byte.
  - **An external search is counted before it searches**, through `recordConversationSearch`, moved
    out of `searchConversations` for both to draw on. A removed member is refused before anything is
    counted, and a search past the allowance is answered with the minutes left and `list_documents`
    as what still works.
  - **The dialog takes the module it describes**, so M21 passes `tasks`; its address hangs off the
    web's `API_URL`, the local backend's against the emulators. It opens from its button as the
    dialog's trigger, so the focus returns to the button, and its code wraps rather than scrolls.
    Its link to Connected agents merges `buttonVariants` through `cn`, since the bare string keeps
    `border-transparent` beside the outline's border and draws none: the consent page's and the
    organization not found page's outline links show the same missing border, left for a fix of
    `buttonVariants` itself.
  - Verified with the tests; `check:oauth` and `check:knowledge-module` against a scratch suite of
    Auth and Data Connect emulators and the branch's backend on its own port, the endpoint included;
    the MCP Inspector's CLI 2.9.0 listing the tools, creating, searching and listing; the SDK's client
    calling every tool over HTTP while the document was open in a browser tab, the append, a
    replacement and a rename arriving without a reload, a keyed retry applied once and a stale
    rewrite refused; and the dialog at 1280 and 390 wide. Not seen: Claude Code's own sign-in, which
    needs an interactive session, and claude.ai, ChatGPT and Cursor, which need production.

### M21: The Tasks module for external agents

- `routes/modules.ts` mounts every module `MODULES` lists, which M20 did for Knowledge alone: the
  Tasks module at `POST /mcp/tasks`, through its own handler, behind the same `requireBearerAuth`
  with its address as `expectedResource`, `Origin` check, body limit and per-connection limit, and
  `/.well-known/oauth-protected-resource/mcp/tasks` beside Knowledge's, through
  `mcpAuthMetadataRouter` at the app's root. Its write tools register the SDK's `scopeChallenge`
  for `tasks:write`.
- An external `list_tasks` with a `query` draws on the member's `ConversationSearch` allowance, as
  an external `search_documents` does.
- The Tasks page's "Use with your agents" button and dialog, staff only: the Knowledge page's
  dialog, made to take the module it describes, with `claude mcp add --transport http
  strategydance-tasks https://api.strategydance.com/mcp/tasks`.
- `CLAUDE.md`'s Modules section names the second endpoint.
- Tests: a Knowledge token refused at `/mcp/tasks` and a Tasks token at `/mcp/knowledge`, each 401
  naming its endpoint's resource metadata; a read-only Tasks connection's `tools/list` holding every
  tool, and its `create_task` answered 403 with `insufficient_scope` naming `tasks:write`, nothing
  written; an external result carrying the tasks' addresses; a query past the allowance answered
  with a result saying so, and a `list_tasks` without a query never counted.
- Verify: locally, add `http://localhost:3003/mcp/tasks` to Claude Code beside Knowledge's, consent
  to each, and have it turn a document's plan into tasks on a board open in a tab; in production, as
  staff, add both to claude.ai and use them in one chat; disconnect Tasks from Connected agents and
  see its next call refused while Knowledge's still works.
- Built with these settled, on 2026-10-11:
  - **`SERVED_MODULES` stays, a list of names**, `knowledge` and `tasks`, filtered over `MODULES`,
    rather than `MODULES` itself, so a module added later joins the external agents by its name once
    its writes are challenged and its searches counted, as `CLAUDE.md` lists. The endpoint, the
    metadata and `OAUTH_PROTOCOL_PATHS` already read it, so serving Tasks changed no route.
  - **Every external `list_tasks` with a query counts, each page included.** A query runs again for
    every page, and a cursor is the agent's to send, so counting the first page alone would let a
    made-up cursor search for free: a cursor is only checked for its shape, so one the agent writes
    itself in that shape is read like one the tool gave. A cursor that does not decode to that shape
    is refused before anything is counted, and a list without a query counts nothing.
  - **The modules share the allowance's code**: `recordModuleSearch`, in `domain/modules/`, counts an
    external caller's search and never Strategy Dance's agent's, and `toTooManySearchesSentence`
    words the refusal, naming the module's read that still works, `list_documents` or `list_tasks`
    without a query. The Knowledge module's refusal reads as M20 wrote it.
  - **The tools the agent is sent did not change by a byte**: the challenge is no part of a tool's
    listing, and `list_tasks`' description does not mention the allowance, as `search_documents`'
    does not.
  - **The Tasks page's button hides with New task while the board has failed to load**, as the
    page's actions did, rather than staying as the Knowledge page's does: `PageHeader` draws its
    actions' box whenever it is given some, and a member who may not connect agents would get an
    empty box, a row of its own on a phone.
  - **The dialog's first Escape closes the copy button's tooltip, and the second the dialog**, at
    1280 and 390 wide alike: opening it focuses "Copy the address", whose tooltip opens on focus, and
    Radix closes one layer an Escape. It is M20's dialog as it is, on both pages, left for a change
    of the dialog itself.
  - Verified with the tests; `check:oauth`, now covering the Tasks endpoint beside Knowledge's, and
    `check:tasks-module`, against a scratch suite of emulators with the branch's backend; and the
    SDK's client over HTTP, as an agent consented to Knowledge through the API and to Tasks on the
    consent page in a browser, turning a Knowledge document's plan into three tasks that landed on
    the board open in a tab without a reload, linking, moving, describing at the version read,
    finding by query, unlinking, deleting off the board and restoring onto it, a keyed retry applied
    once; and the button and its dialog at 1280 and 390 wide. Not seen: Claude Code's own sign-in,
    which needs an interactive session, and claude.ai, which needs production.

### M22: Mentioning knowledge in the composer

- The "+" menu (with "Mention knowledge" only until M26), the `@` list and its keyboard handling,
  mentions sent as `[Title](doc:<id>)`, all as The composer describes.
- Verify: mention two documents, send, see the links in the bubble and the agent read them; mention
  one with Read off and see the agent say it cannot read it.

### M23: Aspect tagging

- The tagging side request and its note, as The agent describes.
- The aspects button on a draft, held in the draft until it is sent, and the first message's
  `aspects`, optional in `POST …/messages`'s body, written with `aspectsSetBy` `MEMBER` in the first
  send's one mutation, so the agent leaves them alone.
- No suggestions and no section on the aspect page, whose design will likely change, as David chose
  on 2026-10-11 (see The aspect page).
- Verify: a new conversation about pricing gets tagged; set aspects before sending and it does not.
- Built with these settled, on 2026-10-11, as The agent § Tagging aspects says:
  - The runs on the first anchor tag, the first or a resume or retry carrying it on, as David chose,
    once the reply is whole and ends the run, before the calls beside a question run. A run tries
    once, as its ledger says, the request marked `purpose: "tagging"`, and nothing about it fails a
    run.
  - The note belongs to no run, so a Retry keeps it, and it counts toward none of a run's entries.
  - A draft's empty pick sends no aspects, so the agent still tags, as David chose.
  - The dialog's line no longer names the aspect page: "Strategy Dance tags a conversation by itself
    until you pick its aspects."
  - The tagging request is counted with its schema, which the API bills as input.
  - Verified: `check:conversation-runs`, `check:conversation-page` and `check:conversation-list`
    against the emulators; `probe:claude`, every check passing; in the browser at 1280 and 390 wide,
    with the placeholder, a draft's picked aspects kept through the send with no note, an untagged
    conversation and an empty pick tagged after the reply, and the list's column; with the real
    model, a pricing question tagged FINANCES and PRODUCT after a knowledge search and its reply,
    and a draft sent with Legal left as the member's, no tagging request sent.

### M24: The dock

- `_ConversationDockProvider` in `router.tsx`'s `InnerWrap`, inside `CurrentOrganizationProvider`,
  whose organization it reads, with its context and `useConversationDock`. Windows are persisted with
  `usePersistedState` under one literal key, holding a map keyed by `${userId}:${organizationId}`,
  since neither is known when it mounts.
- The dock in `AppLayout`, inside `SidebarProvider` after `SidebarInset`, `z-40`, hidden on mobile
  and on the conversation page: windows, read through `useDockConversations`
  (`GetDockConversations`, only the conversations its windows hold), the "+N" menu, focus, Escape,
  unread counts and `MarkConversationRead` while a window is open, drafts in windows, and "Open in dock" on the list
  and the page.
- Toasts stay in the dock's corner, as David chose on 2026-10-11, checked on a screenshot.
- Utilities with tests: how many windows fit.
- Verify: open four conversations at several widths; minimize, close, full page; replies arriving in
  minimized windows count up; a phone width has no dock.

### M25: Attachments: storing them and sending them to Claude

- The `ConversationAttachment` table, as The data describes it, additive.
- In strategydance-core, `CONVERSATION_ATTACHMENT_CONTENT_TYPES`, the types the upload's sniffing
  accepts, which M2 left to this milestone since the plan names no list; and the files case of
  `buildConversationPreview`, a message holding only files previewed as the first file's name or
  their count, additive in `preview`.
- The upload's transport: `PUT /organizations/:organizationId/conversations/:conversationId/attachments/:attachmentId`,
  the conversation's id in the path (a draft's, made by the browser, before the conversation
  exists), the raw bytes as the body with their `Content-Type`, and the file's name in an
  `X-File-Name` header, URL-encoded, one line of at most 200 characters, all validated before the
  reservation.
- `PUT …/attachments/:attachmentId`: member and staff checks, a rate limit, type sniffing, the size
  and the member's quota of unsent files (after deleting their unsent rows older than two days),
  Claude's image limits, a PDF's page count kept in `pageCount`, the stored file read back from
  Storage two at once per instance and uploaded to the Files API, and its tokens counted alone from
  those bytes and kept in `tokenCount`: the row reserved `UPLOADING`
  under the membership lock, the object streamed under `pending/` with a generation-match-zero
  precondition, the row turned `READY` with its `claudeFileId`; stale reservations pruned after ten minutes; deleting a
  pruned conversation's folder and its files in the Files API, and an organization's before its
  rows go; the daily sweeper deleting a day-old file in the Files API that no row names.
  `DELETE …/attachments/:attachmentId` for the caller's own unsent file, idempotent, through the
  prune's claim-then-delete.
- The bucket's lifecycle rule deleting `pending/` objects older than two days, applied with gcloud
  like the CORS rule (a human step, written down beside `storage.cors.json`).
- `GET …/attachments/:attachmentId`: current membership and ownership checked, the bytes streamed
  with private cache headers. `storage.rules` stays as it is.
- `POST …/messages` accepts attachment ids, checks the conversation's budget, its PDFs' total pages
  and its next request's tokens as Attachments counts them (the latest kept request's whole input
  and output, the text after it counted, the files after it by their stored counts), without
  building that request,
  copies each file into
  the conversation's folder and sets each row's `message` once; the transcript's file blocks, each
  referencing its file's id in the Files API; `isFull` set past the limit.
- A load test uploads twenty maximum-size files to one backend instance at once and watches it stay
  within its defaults.
- Tests: removing an unsent file freeing its slot at once, removing it twice answering the same,
  and a sent one refused; the 300-page total summed from stored `pageCount`s without reading a
  file; blocks built from each type; another member's upload under a draft's id neither counted in
  its budget nor pruned with it, and an upload under somebody else's conversation refused; one
  attachment uploaded and sent twice with its ids spelled
  with and without hyphens, stored as one object and one copy; the budget refused; a text file over
  its length refused; a message passing 700000 tokens refused, and one following a long reply
  refused although the last request's input alone, with its files, stayed under it; one whose
  last request was mostly read from the cache; one whose new text is Chinese and emoji; an
  oversized image refused; a PDF over 100
  pages refused, and one that would pass 300 in the conversation; a member at the cap refused before
  any byte is stored, again and again with new ids; a stale reservation pruned; a retried upload
  finishing its reservation; a retry refused once a prune has claimed its row, and a prune never
  deleting the object of a row that became `READY`; two sent at once with one id ending with one
  row; a file reference replayed byte for byte; a file the Files API holds that no row names deleted
  by the sweeper, and one a row names kept; a conversation marked full; retry for a message of files
  alone going back to its anchor, which M10 left here.
- Verify: with a script, upload an image, a PDF and a text file, send them, read the reply.

- Built with these settled, on 2026-10-12, as Attachments § As M25 built it says:
  - A conversation holds at most 100 files and 20 images, as David chose, since Claude refuses an
    image over 2000 pixels a side in a request of more than 20 and takes 600 at most.
  - Files are read back one at a time per instance, the heap collected after each, which the load
    test asked for: two at a time took twenty 10 MiB uploads past 512 MiB.
  - The upload requires `Content-Length`; a retry differing from its row is refused, and one losing
    the race answers as the winner did.
  - Files API names carry the environment, and only production's sweep deletes orphans.
  - The send's measurement counts the config change and the run's context message; `isFull` stays
    the worker's.
  - An organization's Files API files go after its row, within a minute.
  - The web connector's attachment selections move to M26.
  - Verified: the four checks; `check:conversation-attachments`, `check:conversation-runs`,
    `check:conversation-page`, `check:conversation-list` and `check:conversation-search` against the
    emulators; with the placeholder, `send:conversation` with an image, a PDF and a Markdown file,
    each read back byte for byte, a sent one refused removal and an unsent one removed twice; the load
    test peaking at 433 MiB from 220. Not yet: the real model reading the files and `probe:claude`,
    which wait for gcloud credentials on this machine.

### M26: Attachments in the composer and the thread

- In the database package, the web connector's `GetConversationMessageBodies` and
  `GetConversationMessagesBefore` select each message's files (id, name, type, size), ordered by when
  they were uploaded, then by id, which M25 left here with the code that reads them.
- The "+" menu's "Files and images", paste, the tray with upload progress and a remove button
  calling `DELETE …/attachments/:attachmentId`, image shrinking, the budget's message; the thread's thumbnails fetched from `GET …/attachments/:attachmentId` with the
  caller's tokens and shown as object URLs, file chips, the image dialog.
- Verify: attach each type from the composer and ask about it; add and remove thirty files and
  attach again; reach the conversation's budget.
- Built with these settled, on 2026-10-12, as Attachments § As M26 built it says:
  - The tray lives in the composer's draft, and its uploads are the tab's, three at a time, so the
    page and a dock window share one and an upload goes on wherever its conversation is drawn.
  - Images over 1568 pixels or 5 MB are drawn again in their own type whatever their size, a GIF
    left as it is; a file the conversation does not take, too large, empty or one past ten is named
    and never goes up. Thumbnails are small copies, so no thread holds its images decoded whole.
  - A failed upload is tried again under a new id once the old one is removed; a send whose files
    expired uploads them again for the reader to send. An upload goes up as the account that added
    it, or not at all.
  - A paste attaches files only when it carries no text.
  - The thread follows Claude's order, and its file chips read nothing, as designed.
  - Verified: the four checks; `check:conversation-page`, with a message's files read in order and
    another member's left out, `check:conversation-attachments` and `check:conversation-list` against
    the emulators; in the browser at 1280 and 390 wide, page and dock, with the placeholder: a PNG
    and a JPEG past 1568 pixels stored shrunk, a PDF, a Markdown file given no type, a CSV typed as a
    spreadsheet and a text file attached through the menu and sent alone and with words, a pasted
    screenshot, thumbnails, chips and the dialog after a reload, the sent images never read back,
    progress and removal mid-upload under a throttled connection, an SVG, an 11 MiB file and an
    eleventh file refused, thirty files added and removed then attached again, the thirty unsent
    files refused then freed by a removal, the budget refused at 15 MiB with the words then sent
    alone, a draft's dock window closed with its files removed, an upload failed by a dropped
    connection then uploaded again, and a 10.5 MB photo stored shrunk to 340 KB while a 6 MB GIF is
    refused, the tray, thread and dialog decoding 256, 400 and 1568 pixels. Not yet: the real model reading
    the files, which waits for gcloud credentials on this machine, as M25's did.

### M27: Integrations: the organization's servers

- `OrganizationIntegration`: name, `https` URL, catalogue slug, authentication (`OAUTH`, `API_KEY`
  or `NONE`), `isEnabled`, `configRevision` (see below), the key encrypted with Cloud KMS and its
  last four characters, `keyGeneration` (bumped whenever the key is replaced), how the key is sent
  (`apiKeyScheme`: `BEARER`, as `Authorization: Bearer
  <key>`, the default, or `HEADER`, the key alone in the header `apiKeyHeader` names, such as
  `X-API-Key`, validated as an HTTP token of at most 64 characters and refused when it is a header
  the client sets itself or one proxies act on: `Host`, `Content-Length`, `Content-Type`, `Cookie`,
  `Connection`, `Transfer-Encoding`, and the `Proxy-`, `Sec-` and `Mcp-` families; changing either
  bumps `configRevision`), the OAuth client it registered, its tools as last listed (annotations included), `autoApprovedTools` (tools
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
  bumps the integration's `configRevision`, a counter M29's pending approvals are bound to.
- The server dialog lists its tools with a switch each for running without approval. A tool's
  `readOnlyHint` is shown beside it as the server's own claim, which may suggest a choice, never make
  one: the MCP specification calls annotations untrusted.
- Backend routes for administrators: add (connects with `@modelcontextprotocol/client`, the SDK
  M14 installed, over Streamable HTTP and lists the tools), edit, delete, turn on and off, retry.
  An OAuth server answers 401 before any member has connected, so adding one runs only its
  discovery here, the protected resource metadata and the issuer it names, and its tools wait for
  the first connection in M28: until then the dialog says to connect an account to list them, and
  its auto-approval switches wait with them. Deleting sets `deletedAt`, keeping
  the secrets for Undo; the daily sweeper (M8) removes it a day later, with its connections, pending
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
  guarded. OAuth discovery and token requests (M28) use the same guard.
- The guard ships with deterministic tests, a fake resolver and transport standing in for the
  network: representative IPv4 and IPv6 addresses of each special-use range (private, loopback,
  link-local, unique local, carrier-grade NAT, multicast, documentation, `0.0.0.0` and `::`),
  IPv4-mapped IPv6 forms, the metadata names, a public address allowed, a resolver whose answer changes between the check and the
  connection, a redirect to a blocked address, a timeout, and a response past the size cap.
- The Integrations page as designed (table, server dialog, gallery with marks in
  `public/assets/images/mcp/`), staff gated, and its sidebar item. Check each catalogue address is a
  real remote MCP server before shipping it.
- Tests: a key sent as a bearer token and in a named header, and a reserved header name refused.
- Verify: add a key-based server and see its tools; add an OAuth one and see its discovery pass and
  its tools wait for a connection; turn one off, delete and undo.
- Built with these settled, on 2026-10-13:
  - The list query checks membership alone, the page and the routes holding the staff gate, as David
    chose (see Release gate). A failed add or edit saves nothing and says why beside the field to
    fix, as David chose; the table's Error and Retry are for a server that failed a later try.
  - The catalogue is its own package, strategydance-external-mcp-servers, a JSON list and lookups,
    as David chose, with 59 servers he picked from those checked: each answers at its address as an
    MCP server, a nonsense path on its host answering otherwise, and each OAuth one offers S256 and
    dynamic registration or client ID metadata documents, without which M28 could never connect it.
    The design's Google Calendar, Gmail and Google Drive addresses had no server; HubSpot's, Slack's,
    Box's, Xero's, Zoom's and Asana's V2 authorization servers offer no way to register; GitHub's
    neither, so GitHub is listed with a personal access token as a bearer, the catalogue's one
    key-based server. `bun run probe:integrations` checks every entry through the backend's own
    guard and discovery. Marks are Simple Icons glyphs in each brand's colour; Simple Icons has none
    for 22, which draw their initial.
  - Discovery never uses the SDK's `discoverOAuthServerInfo`, which takes the server's origin as its
    authorization server on any failure: a passing outage would read as another issuer and clear
    everything. The origin is taken only when every metadata address answered 404, as Atlassian's
    server, which has no protected resource metadata, needs.
  - Listing tools speaks a 2025 handshake first, as every remote server does today, and the
    2026-07-28 revision when a server answers that it speaks only that.
  - The OAuth client's columns, members' connections and pending authorizations are M28's, which adds
    them to the writes that clear what was given for another server.
  - A Data Connect rule found on the way: a nullable variable left out of a write keeps its column,
    so the write that clears a key is called with every such variable, null included.
  - Closing the MCP client aborts its stream of server events, which destroyed a TLS socket nothing
    listened to under Bun and took the backend down: the request's socket is listened to now.
  - Verified: the four checks; `check:integrations` against an emulator of the branch's schema;
    `probe:integrations` on all 59 servers; in the browser at 1280 and 390 wide, against the
    emulators, DeepWiki added by its address and its three tools listed, Linear added from the
    gallery with its tools waiting, GitHub with a made-up token refused under the key field,
    `metadata.google.internal` refused, a server turned off and on, deleted and restored, and a
    member's read-only view. Not yet: a real key listing a key-based server's tools, which needs a
    token, and Cloud KMS in production, set up as step 9 says on 2026-10-13 and first used by the
    release.

### M28: Integrations: members connect their accounts

- `IntegrationConnection`, one per member and server: the account's label, tokens encrypted, expiry,
  status, and `generation`, bumped on every connect and kept by a refresh. Pending authorizations: references to the initiating member and integration (all the
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
- The first connection to an OAuth server lists its tools with that member's token, and retry
  lists them again with the token of whoever asks; the tools are taken to be the same for every
  account, as remote MCP servers expose them, and a call an account may not make fails when made.
- The page shows each OAuth server's status for the viewer, with Connect and Disconnect for
  themselves, and the design's waiting dialog.
- Tests (database and server mocked): two concurrent callbacks with one `state` making exactly one
  exchange, and a replayed one making none; an unknown and an expired `state` refused; a pending
  authorization cleared by a change of address, authentication or issuer, its callback then
  refused; two concurrent refreshes spending a rotating refresh token once, the second reading the
  first's tokens; a lapsed refresh lease taken over; the first connection listing the tools.
- Verify: connect two members to the same server as different accounts; disconnect one.
- Built with these settled, on 2026-10-13:
  - **The signed-in member finishes the exchange**, as David chose: the unauthenticated callback
    consumes the state first, as above, but keeps the code, encrypted, for two minutes, and redirects
    to an app page, `/integrations/connected`, which the member's own session finishes. The backend
    exchanges the code only for the account that started the Connect, deleting the Connect under
    `@check(this == 1)` before the exchange, so two finishes exchange once. Without it, anybody
    administering an organization could start a Connect, send its sign-in to somebody else, and have
    that person's account connected to their own membership (OAuth CSRF, RFC 9700 4.7), in one click
    where a provider skips its consent for a client it knows, as the shared client ID metadata
    document is.
  - **The account's label is best effort**, as David chose: the email, username or name of an OpenID
    ID token when the server sends one, unverified since it decides nothing and only its member reads
    it; otherwise the page says when they connected. No scope is asked for it.
  - **A member's Connect whose discovery names another issuer is refused**, as David chose: only an
    administrator's Retry takes a new authorization server, since it disconnects everybody.
  - `offline_access` is asked for wherever the authorization server lists it, so a connection gets a
    refresh token rather than lapsing with its access token, the SDK then asking for consent again.
  - `generation` is a UUID made at every connect, never a counter, so no disconnect, reconfiguration
    or removal of the member ever brings one back: M29 stores it as text in
    `approvalCredentialGeneration`, beside a key-based server's `keyGeneration`.
  - The refresh's lease is claimed only while the connection holds the refresh token its caller read,
    so a caller whose read another refresh overtook claims nothing, lasts two minutes, past every
    request and encryption a refresh makes, and is written and released by its id alone. A refusal
    for good marks the connection only while it holds the access token that refresh read; one with no
    refresh token is marked on its refused token alone (`MarkIntegrationConnectionTokenRefused`, for
    M29's 401).
  - The changes that clear what was given for another server write the server's row first and delete
    its connections and Connects after, which a Connect's own write locks against, so under read
    committed none outlives them.
  - A client the authorization server answers as unknown is forgotten, so the next Connect registers
    again, and each connection issued to it is marked as needing its member at its own next refresh,
    which the server refuses as it did. A registration asks for a public client wherever the server
    lists one, else for `client_secret_basic`, else `client_secret_post`, and for `client_secret_basic`
    where it lists none, as RFC 8414 reads a list left out; the method it answers is the one kept, and
    the secret it gives is encrypted for the server alone. In development, whose callback is http, the
    client is registered as a native one, and no metadata document is offered.
  - The integration routes hand their operations canonical ids, since the page a sign-in ends on names
    them hyphenated, and a live query's refresh compares its variables as text.
  - The waiting dialog ends on the member's live connection appearing anew, the proof, or on the
    landing page's word over a `BroadcastChannel`, a nudge; a blocked window is offered as a link; the
    window's `closed` is never read, since a provider's Cross-Origin-Opener-Policy makes it lie.
  - "Add and connect", the design's button for an OAuth server being added, is left for later: adding
    one still adds it, and its row offers Connect.
  - Verified: the four checks; 39 flow tests through the real SDK and guard against a fake MCP server
    and authorization server, and the routes' own; `check:integrations` against an emulator of the
    branch's schema; in the browser at 1280 and 390 wide, against the emulators and the same fake
    provider served to the backend, an administrator adding an OAuth server and connecting as one
    account, a member connecting the same server as another, each reading their own label, the tools
    listed on the first connection, a disconnect revoking its refresh token, a Cancel followed by a
    sign-in that connected nothing, a refusal, a sign-in the member started finished in the
    administrator's browser and refused, a blocked window's link, and a server turned off; and
    Linear's real authorization server registering Strategy Dance and showing its consent page. Not
    yet: approving at a real server, which needs an account there.

### M29: Integrations in conversations

- The three integration tools; calls with the member's own connection or the organization's key,
  30 seconds each; `lastUsedAt`; a 401 marks the connection as needing authentication.
- **The schema change**, additive, with `APPROVAL` appended to the kinds: `ConversationMessage` gains
  `integration` (an optional reference, nulled if the server is pruned), `integrationName` (at call
  time), `integrationToolName`, `approvalState` (`PENDING`, `ALLOWED`, `DENIED`), `approvalConfigRevision`,
  `approvalToolHash` and `approvalCredentialGeneration` (see below; text, since an OAuth server's
  connection's `generation` is a UUID), and
  `argumentsPreview` (display text, cut to 2000 characters), the live tail selecting the state and
  `GetConversationMessageBodies` the rest, both extended here; the
  warning strip matches the live integrations list by `integration`, never by name. A preview
  authorizes nothing, since what matters can sit past its cut: Allow opens a dialog showing the
  complete stored `toolInput`, lossless JSON text drawn with control characters escaped, keys and
  nested values alike (`GetConversationToolCall` reads a pending call too), whose own Allow
  approves; arguments past 100000 characters are refused before an approval is drawn. Tested with
  arguments holding U+0000 in a nested key and a value, shown escaped and run as shown.
- **Approval.** Every integration call waits for the member unless its tool is in the server's
  `autoApprovedTools`: the run ends `WAITING` on an approval entry (a new `APPROVAL` kind) showing the
  server, the tool and its arguments, with Allow (the call runs in the next run) and Deny (answered
  as refused), answered as questions are. Annotations decide nothing: a server can mislabel a tool
  that writes, and a read can carry private text out in its arguments. Injected text can then
  propose an action, never take one, except through an auto-approved tool, which it can get called
  at once with any arguments: the switch says so, and administrators allow only tools whose effects
  and reach they accept from anything the agent reads. Like a question, an approval is never
  refused for room: one waiting in a full conversation can still be answered, as Size says.
- **An approval is bound to the server, the tool and the credential it showed.** The entry records
  the integration's `configRevision`, the hash of the tool's definition (as `autoApprovedTools`
  hashes it) and `approvalCredentialGeneration`, the generation of what will make the call: the
  key's `keyGeneration` on a key-based server, the member's connection's `generation` on an OAuth
  one. Allow checks all three against the integration as it is, and so does the continuation right
  before the call, so a change of address, authentication or issuer, a refresh that changes the
  tool, a replaced key or a reconnect to another account never lets an approval given for one run
  as another (a token refresh keeps the generation, and the approval): on a mismatch the approval
  is marked denied and the call answered as refused, saying the integration changed since it was
  proposed, so the model can propose it again. Tested at Allow and at the call, for an address
  change, a changed definition, a replaced key and a reconnect, and a token refresh passing.
- **A waiting approval counts as a waiting question everywhere**: its run ends `WAITING`, which sets
  `isAwaitingAnswer`, so it raises
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
- Built with these settled, on 2026-10-14:
  - **A turn's other calls run beside an approval**, as David chose: as beside a question, every call
    of the turn but the one waiting runs at once, its result kept on the run, and only the call the
    member allows runs in the next run, so a later write can land before an earlier call the member
    then allows.
  - `list_integrations` and `describe_integration_tool` are strict, and `call_integration_tool` is
    not: a strict schema sets `additionalProperties: false` on every object, which a call's
    `arguments` cannot take. Its input is checked on the worker, as a module's tools' are. The three
    are always in the tools list and always run, whatever the organization added.
  - **The decision is made once, when a call is drawn**, from the server as it is then: refused,
    drawn failed with the server it named, so the thread can say what fixes it; run at once,
    auto-approved, drawn running with its binding; or drawn as an `APPROVAL`, pending. Planning stays
    the transcript's alone, so a worker taking over plans the same and follows what was drawn. An
    auto-approved call keeps its binding too, so a Resume hours later never calls a server whose
    address, tool or auto-approval changed.
  - **An approval is a tool call with an approval on top**: its `toolStatus` stays null until a run
    starts its call, since a call is `RUNNING` only while a run holds it; a Deny, a send while it
    waits, and an Allow after the binding changed each finish it failed, with the sentence its result
    sends. `answeredAt` marks it answered, so every waiting count reads questions and approvals alike.
  - **A continuation that carries an allowed call stores no entry**, since the call has not run:
    `ContinueConversationRunWithCalls` anchors its run where the waiting run was, copies its results,
    and answers the calls a stop kept from running as stopped, which a resumed run would otherwise
    make. Its worker makes the allowed calls, checks the results entry with `checkTranscript`, stores
    it and anchors the run on it, so Retry, the fifty calls and tagging treat it as an answer
    continuation, and a Retry keeps a call that went to another company's server.
  - **A call to an integration that started is never made again**: a crash or a stop leaves it to be
    finished as interrupted, its result saying it may have run. Only a 401 marks the member's
    connection; a 403 refuses the call for that account alone. A call has 30 seconds in all, its own
    request the whole of what is left after the handshake, and marks its server used at most once a
    minute, in a write no live query refreshes on.
  - A send names the approvals it denies and the allowed calls it answers as not run, each by a list,
    which a backend from before M29 leaves out and is refused for, rather than leave a call nothing
    answers. A continuation names the calls it closes the same way.
  - `list_integrations` stays under 40000 characters, its tools' descriptions cut first, then left
    out, then each server listing fewer tools by name.
  - The approval is built from the question's look, which the design leaves it: the server, the tool
    and the start of what it sends, Deny, and Allow, which opens the whole input, escaped as the
    output dialog escapes it, whose own Allow approves. Decided, it draws as the call it became,
    "Allowed" until it runs and "Denied" once refused.
  - The warning strip matches the live list by the server's id, and reads it, with the reader's
    connections, only while the thread holds a call to an integration. `?connect=` opens the server's
    dialog, whose Connect the member clicks, since a browser opens a sign-in window only inside a
    click; `?enable=` turns the server on for an administrator, as designed; `?add=` opens the add
    dialog from the catalogue by name. Ids go into the address hyphenated.
  - Verified: the four checks; `check:integrations` and `check:conversation-runs` against an emulator
    of the branch's schema; `probe:claude` on the real API, Claude calling `call_integration_tool`
    with its arguments as an object; in the browser at 1280 and 390 wide, page and dock, against the
    emulators and the real model, with DeepWiki added by its address: Claude listing the
    integrations, reading a tool, saying what it proposes and waiting on the approval, raised in the
    sidebar's badge and the list's "Needs your answer" with "Approval: DeepWiki · ask_wiki_question";
    Allow opening the whole input, the call made in the next run and its answer used; Deny, and a
    message sent instead, each drawn denied; an administrator letting one tool run without approval,
    which then ran straight away; the server turned off, Claude saying so from the list, the strip
    under an earlier call offering Turn on, which turned it on and cleared the address; and
    `lastUsedAt` shown. Found on the way: the integration reads were handed a run's whole fence, which
    Data Connect refuses, a variable the fake now refuses too. Not yet: an OAuth server's Connect in
    the strip, which needs an account at a real OAuth server.

### M30: Subagent conversations and their runs

What a subagent is, and why each rule below holds, is in Subagents. This milestone makes a subagent
and runs it once; M31 chains its runs, bounds how many go at once and gives them a queue of their
own.

- **The schema change**, additive:
  - `Conversation` gains `parent`, indexed as every reference is, `launchRunId`, `launchToolUseId`,
    `launchAnchorPosition`, `report`, `reportedAt` and `subagentCount`, and `ConversationMessage`
    gains `attachmentIds`, a `BRIEF`'s files. `reportDeliveredAt` comes with the reaction, in M33.
  - `ConversationRunTrigger` gains `LAUNCH`, and `ConversationMessageKind` `BRIEF`, each appended.
    `CONTINUE`, `PENDING` and `CHAINED` come in M31, `REPORTS` in M33.
  - `MAX_SUBAGENTS_PER_ACTION`, `MAX_CONVERSATION_SUBAGENTS`, `MAX_SUBAGENT_BRIEF_LENGTH` and
    `MAX_SUBAGENT_REPORT_LENGTH` go in strategydance-core (see The data).
  - Every web read that lists conversations, the list, the badge's and the dock's, filters on
    `parent` being null. So do the backend's searches and the counts that `MAX_CONVERSATIONS` and
    `MAX_ACTIVE_RUNS_PER_MEMBER` hold: a subagent is in none of them, and nothing a member sees
    changes in this milestone. The reads of one conversation by its id stay as they are, keyed on
    the member, and read a subagent, which M34's viewer needs.
  - Every way a member acts on a conversation refuses a subagent (see Subagents): the send, answer,
    Resume, Retry, Stop and reconcile routes, an upload under its id, and the web's delete, restore,
    read and aspects mutations, `parent` null in each filter.
- `launchSubagent` in `domain/subagents/`, called directly here, since the module comes in M32. It
  runs the one mutation Modules § The Subagents module's tools describes, taking the membership
  lock, which counts the ten, those a Retry deleted left out, then the parent's row, which counts
  the hundred, the order every run start keeps, then the queueing. Its first run is `QUEUED`, since
  the slots come in M31. It takes only files the conversation has sent, and with files it measures
  the subagent's first request whole, system prompt, tools, context, brief and files, as
  `measureConversationMessage` measures a send, refusing one past a send's budget. The call's key joins it in M32, and so do the checks of the launching run,
  inside the mutation: M30's script launches from no run, `launchRunId` and `launchToolUseId` null,
  on the parent's latest anchor.
- **The subagent's run**, in `runConversation`:
  - Its system prompt, `subagentSystemPrompt.ts`, and its tools list, both pinned by their bytes.
  - The brief as its anchor, its files sent by their Files API ids.
  - No tagging, unread count or question.
  - A conversation run's limits, which end it `FAILED` with its note as they end any run, until M31
    chains it.
  - The report, cut to 8000 characters, written by the mutation that ends its run, however it ends.
- Its runs go where every run goes, the backend's process in development and `conversation-runs`
  elsewhere, until M31 gives them a queue of their own. Nothing launches one in production before
  M33, and nothing recovers a dead one before M31's reconcile and sweep, which development, with the
  script below its only launcher, does without.
- `bun run launch:subagent <email> --conversation <id> [--file <attachment id>]… <brief>` calls
  `launchSubagent` in its own process, as that account of the emulators, refusing to run anywhere
  else, as `mcp:knowledge` does, since no route launches one until M32's module. Its runs then go
  in that process, as every run does in development, and the script stays until they report.
- `CLAUDE.md`: what a subagent is, and that every read or count of a member's conversations leaves
  subagents out.
- **Tests** on `createConversationDatabaseFake` with the scripted client:
  - A subagent's thread read by its id through the tail, bodies, history and run queries, and another
    member's subagent id reading nothing.
  - Each route and web mutation refusing a subagent's id, called directly.
  - The brief's files sent by id.
  - A file a draft holds refused, and files that fit the budget alone refused once the first
    request's prompt, tools, context and brief take it past.
  - The ten not counting subagents a Retry deleted, and the hundred refused.
  - The report written at each way a run ends, cut to 8000 characters, and a run at its limits
    failing with its report.
  - A subagent left out of the list, the counts and search.
- `bun run check:subagent-runs`, in the backend's package, checks the launch's mutations against
  the emulators.
- **Verify**: launch three subagents from the script against the emulators, under
  `CONVERSATION_AGENT=placeholder` and then the real model, and read their transcripts and reports.
- Built with these settled, on 2026-10-15:
  - **A subagent's run ends through endings of its own**, `FinishSubagentRun`,
    `FinishSubagentRunWithNote` and `InterruptSubagentRun`, which write `report` and `reportedAt` in
    the write that lets go of `activeRunId`, since no write sets a column for some rows and not
    others, and a mutation writes each row once. Every other ending's fence matches a conversation
    that is no subagent, so no subagent ends without its report, and `finalizeDeadConversationRun`
    answers `missing` for a subagent's run until M31 finalizes one with its report. Its text is drawn
    by `DrawSubagentAgentText`, `DrawConversationAgentText` without the unread count; a subagent
    draws no question or approval, its planner refusing a stray `ask_user` as a tool nobody runs.
  - **The report** is its last text, read from its transcript's replies alone, never its brief or a
    context message, a run that did not complete leading it with a sentence saying how it ended, at
    its limits (`isAtLimit` on the ending), failed, full, refused, stopped or interrupted, and one
    that wrote nothing saying that alone. Past 8000 characters it is cut at its last line break, or
    else its last space, and marked with an ellipsis: a piece's cut stops at the block before a long
    code block, which left a report of a few characters.
  - **The system prompt is passed beside the tools** (`ConversationRequestConfig`), to the request,
    its measurement and a send's, so a subagent's request can never send the conversation's prompt.
    A subagent's context names its parent's aspects, read through `GetConversationRequestContext`'s
    `parent`, and its files are counted from `parentAttachments`, its parent's sent files, since
    `replaceConversationFiles` refuses a file it has no count for.
  - **Ids** derive from the parent's and the launch's key (`deriveUuid`, which
    `deriveConversationMessageId` now calls): the subagent's, its run's and its brief's. A launch sent
    again finds the subagent's key taken, which Postgres reports before the query step's own check,
    and reads it back. The brief names its run, as the member's message does, and the run's drawn
    entries leave it out (`nin: [MEMBER_TEXT, BRIEF]`).
  - **The web connector's reads and mutations are checked by `check:subagent-runs`**, since the fake
    holds the backend connector's operations alone: a subagent's tail, bodies, history and run read
    by its id, nothing for another member, and the delete, restore, read and aspects mutations
    refusing it. The routes refusing a subagent are tested on the fake, each with what would let it
    act on a conversation of the member's.
  - The script titles the subagent after its brief, as a conversation is titled after its first
    message, and launches on the conversation's latest anchor with a key of its own.
  - Verified: the four checks; `check:subagent-runs`, `check:conversation-runs`, `-search`, `-list`,
    `-attachments` and `-page` against an emulator of the branch's schema; three subagents launched
    at once from the script under the placeholder, and one handed a file of its parent's, each
    completing with its report. Not yet: the real model, which waits on gcloud's credentials here.

### M31: Chains, slots and the subagents' queue

- **The schema change**, additive: `ConversationRunTrigger` gains `CONTINUE`, and
  `ConversationRunStatus` `PENDING` and `CHAINED`, each appended, with `MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER`
  and `MAX_SUBAGENT_RUNS` in strategydance-core. The web's exhaustive maps over those enums take the
  new values in the same milestone, or the typecheck fails: `isOlderConversationRun`'s ranks of
  `ConversationRunStatus`, `PENDING` before `QUEUED` and `CHAINED` beside the other endings, with its
  tests.
- **The chain**: `CHAINED` at any of a run's three limits, 25 requests, 10 minutes or 100 entries,
  before the fourth run, the `CONTINUE` run carrying on as Resume does, and the tool calls' budget,
  counted from the anchor today, fifty for each run the chain has taken, read from the run's number.
  The fourth run's 25th request, after a turn's tool results, carries the text block asking for the
  report now. The report is written by the mutation that ends the last run.
- **The slots**: a launch first finalizes the member's dead subagent runs in the organization, as a
  run start finalizes their dead runs (`finalizeDeadConversationRuns`), then counts the slots under
  the membership lock and inserts its first run `QUEUED` or `PENDING`.
- **The promotion**, a mutation of its own taking the membership lock, after a write that ends a
  subagent for good from a run that held a slot, never after one that chains or one that ends a
  `PENDING` run: it promotes the member's oldest `PENDING` runs into the slots then free, setting
  each one's `createdAt` from the database's clock, and skips a run whose membership is gone, one
  asked to stop and one whose subagent is deleted, which the reconcile and the sweep finalize.
- **The `subagent-runs` queue**, with `SUBAGENT_RUN_QUEUE_PATH` beside `CONVERSATION_RUN_QUEUE_PATH`
  (setup step 11). A run's queue follows from it, a subagent's or not, and is carried through
  everything that touches its task: `enqueueRun`, `queueConversationRun`,
  `buildConversationRunTaskName`, since Cloud Tasks takes a task's name only under the queue it is
  created in, `findConversationRunTask`, which recovery asks, and the requeueing of a dead run. Tests
  create, look up and requeue a run on each queue. The worker's route stays the same.
- **Recovery**: the reconcile route for a parent's subagents, `POST …/subagents/reconcile`, and the
  sweep's backstop, finalizing the member's dead subagent runs across the organization and the
  `PENDING` runs the promotion skips, queueing again and promoting. The page calls the route from
  M34; until then the sweep is the only caller in production, where nothing launches yet.
- `CLAUDE.md`: the subagents' queue, and that a run is `QUEUED`, `RUNNING` or `PENDING` exactly
  while its conversation's `activeRunId` names it, the rule § The database states for the first two.
- **Tests** on `createConversationDatabaseFake` with the scripted client:
  - A chain of four runs, the fourth's 25th request carrying the request for a report after its
    tool results and the reply it drew becoming the report, and a run chaining at its 100 entries.
  - A sixth launch waiting `PENDING`, and promoted by another's end.
  - A chain while all five slots are taken, promoting nothing and staying at five.
  - A `PENDING` run stopped while five run, promoting nothing.
  - Two ends at once promoting one run once.
  - A `PENDING` run of a member removed, skipped by the promotion and finalized by the sweep, and
    one asked to stop, or whose subagent is deleted, skipped and finalized as stopped.
  - A launch finalizing a dead subagent run of another parent's before it counts, and running.
  - A run promoted after twenty minutes pending, its queueing failing, queued again by the
    reconcile rather than finalized.
  - A dead subagent run finalized by the reconcile, and reporting so.
- `check:subagent-runs` gains the promotion and the chain's mutations.
- **Verify**: launch six subagents from the script against the emulators, five running and the
  sixth waiting until one ends; and, with the real model, one brief long enough to chain, read
  through its runs and its report.
- Built with these settled, on 2026-10-16:
  - **Two launch operations**, since a new required variable on `LaunchSubagent`, or the `Boolean!`
    an `@include` needs, would be a breaking connector change: `LaunchSubagent` gains the slot
    check, and `LaunchPendingSubagent` inserts the run `PENDING` with no lease. A launch that read
    the five taken inserts pending, then promotes itself: an end committing while the launch held
    the lock reads no run waiting yet, so its promotion promotes nothing, and the launch's own
    promotion is what gives the freed slot to the oldest run waiting, this one or an older.
  - **One run a promotion** (`PromoteSubagentRun`), looped oldest first by `promoteSubagentRuns`,
    each read again after, a run refused once skipped, so each write names the subagent its live run
    refreshes on. The runs it skips end through `StopPendingSubagentRun`, while the run was asked to
    stop or its subagent is deleted, and `InterruptPendingSubagentRun`, while no membership has the
    `createdAt` it was launched under, each fenced on its reason, so a stale read never ends a run
    that could be promoted, and each writes its note and report.
  - **The chain is decided at the ending, from `isAtLimit`**, so every limit chains a run numbered
    below 3, the stream's fourteen minutes included, which belong to the ten. A run asked to stop as
    it reaches a limit stops instead, read before the chain, which is fenced on no stop too, so a
    stop that committed first is never lost on a run it never named. The chain writes no note and
    leaves the calls running `RUNNING`, since the next run runs them, and carries the results kept
    only from the ten minutes before a call, the one limit met mid-turn.
  - **A chain is finished once its next run is queued**: the next run's id derives from the chained
    one's (`deriveChainedRunId`), so a step that reads its own run `CHAINED` after the answer was
    lost, and a delivery that finds it `CHAINED`, queue the same run, and a queueing that fails
    answers `held`, for Cloud Tasks to deliver the chained run again. A chain sent twice is refused
    on the next run's number, which Postgres reports before the fence's own check, as a launch sent
    again is refused on its id.
  - **A run's queue is a required argument** (`ConversationRunQueue`) of everything that touches its
    task, `finalizeDeadConversationRun(s)` included, where it also says which kind of run is meant:
    a subagent's on `subagent-runs` ends through `InterruptDeadSubagentRun` with its report, and
    either kind is `missing` to the other's queue, so the member's run reconcile still never reaches
    a subagent's.
  - The fourth run's last request ends the results entry with `SUBAGENT_REPORT_REQUEST`, stored in
    the transcript, so a replay sends the bytes it was sent as.
  - `bun run launch:subagent` takes `--count`: a promotion runs the subagent it promotes in the
    process whose run freed the slot, so six launched from six scripts would lose a promoted run to
    the first script to exit.
  - **For M32 and M33**: a Stop whose update waits on a chain's lock finds the old run `CHAINED` and
    passes over it, so `stop_subagent`, the parent's Stop and its cascades reach the subagent's run
    by its `activeRunId`, or read again after, never by the run they read before.
  - Verified: the four checks; `check:subagent-runs`, `check:conversation-runs`, `-attachments`,
    `-list`, `-page` and `-search` against an emulator of the branch's schema; six subagents
    launched at once from the script under the placeholder, five running and the sixth waiting until
    one ended, every one reporting. Not yet: a brief long enough to chain on the real model, which
    waits on gcloud's credentials here (`gcloud auth login`). Setup step 11, the `subagent-runs`
    queue, is still to do before M33's release.

### M32: The Subagents module

- `MODULES` gains `subagents` (see Modules § The Subagents module's tools), kept out of
  `SERVED_MODULE_NAMES`, and `MODULE_SERVERS` gains its server.
- **The authorization server keeps to the served modules**: `SERVED_MODULE_NAMES`, unexported in the
  backend's `constants.ts` today, moves to strategydance-core beside `MODULES`, and `parseModuleResource`, the metadata's `scopes_supported`
  and the consent page read it rather than `MODULES`, so a client asking for `/mcp/subagents` is
  refused as for an address no module has. A test asks for it, and `check:oauth` does too. The `module` catalogue words it, as
  `getModuleMessages`' type asks, with `bun run translate`. Its results carry no web address, so
  `createModuleAddresses` stays as it is.
- `src/modules/subagents/`, one tool per file, in the order the table lists them, over
  `domain/subagents/`: `list_subagents` and `read_subagent` read, `launch_subagent` and
  `stop_subagent` write under a key, as `readModuleWriteCall` reads it.
- `ModuleCaller` gains an optional `launcher`, `{ conversationId, runId }`, for an agent caller,
  which `toModuleAuthInfo` and `readModuleCaller` carry, the strict schema of the second gaining
  it, and which only a worker that has claimed a run fills. `measureConversationMessage` keeps
  connecting without one, before any run exists, and every Subagents tool refuses a caller without
  it.
- The launch's mutation reads the launching run after it writes the parent's row, still `RUNNING`
  and not asked to stop, so a Stop or a delete it races is seen whichever commits first. A read takes
  no lock, so the one order holds.
- `list_subagents` and `read_subagent` leave out the subagents a Retry deleted, reading them as
  missing: the run that launched them is cut from the transcript, so the agent knows nothing of them,
  and their reports are never delivered.
- The refusals, each a sentence the model can act on:
  - from a subagent;
  - from a run that has ended or was asked to stop;
  - past ten launches on the anchor, those a Retry deleted left out, or 100 in the conversation;
  - a file the conversation has not sent, or a first request past a send's budget, measured whole;
  - a subagent of another conversation.

  A launch from a reaction is refused from M33, which adds `REPORTS`.
- `createSubagentsDatabaseFake` joins `createModuleDatabaseFake`, as each module's fake does.
- **Tests** through `createModuleTestKit('subagents')`:
  - A launch called again with its key finding the same subagent.
  - Another tool with that key refused.
  - Each refusal.
  - A stop of an ended subagent changing nothing.
  - A launch on a deleted parent, or from a run asked to stop, refused.
  - Each tool refusing a caller without a launcher, whose tools list still holds the four.
  - `read_subagent` paging a subagent's writes past 50, with their `total`.
  - A subagent a Retry deleted left out of `list_subagents` and read by `read_subagent` as one that
    does not exist, since the transcript no longer holds the call that launched it.
- `bun run check:subagents-module`, in the backend's package, checks its operations against the
  emulators.
- No endpoint is served: `check:oauth` only checks that `/mcp/subagents` is refused, as the bullet
  above says, and the module reaches external agents in a later plan, with everything Module
  conventions asks of a served one.
- Built with these settled, on 2026-10-17:
  - **The tools load their domain at call time**, as David chose: the subagents' domain is the
    conversation runtime, which `launchSubagent` reaches through `enqueueRun` and
    `measureSubagentLaunch`, some 210 files and 66 operations and enums the modules' fake lacks, and
    every Knowledge and Tasks test loads every module's server. Each tool `await import`s its domain
    function inside its handler, which also breaks the cycle `connectConversationModules`,
    `moduleServers`, `launchSubagent`, `measureSubagentLaunch`. There is no
    `createSubagentsDatabaseFake`: the module's tests run on `createConversationDatabaseFake`, which
    holds the modules' fake and every subagent operation, the new ones included.
  - **A launch pair of its own**, `LaunchSubagentForAgent` and `LaunchPendingSubagentForAgent`, since
    the `Boolean!` its key's `@include` needs and a required `$launchRunId` would break the
    connector: the same locks, checks and rows as M30's pair, its key stored after the membership's
    lock, and the launching run read after the parent's row, still `RUNNING`, not asked to stop and
    on the anchor the launch counts the ten on. M30's pair stays for the script, which launches from
    no run. A launch called again is refused on its key before its subagent's id.
  - **A launch reads its key first**, each round: a key held by another call is refused, and one
    holding this launch is answered as it was once its subagent is queued again or promoted, as a
    launch whose answer was lost needs, and launches nothing anew when its subagent was pruned since.
    The launching run is read each round too (`GetSubagentLauncherForAgent`), its anchor the one the
    launch is made on, so a run refused for a Stop meanwhile is answered with the Stop's sentence.
  - **The key keeps `{ id, title, status }`** as the launch inserted it, `QUEUED` or
    `WAITING_FOR_SLOT`, and every answer of the launch says what the key keeps, so a pending launch
    that took a slot freed meanwhile answers `WAITING_FOR_SLOT` the first time as a call again does,
    and the reads say where it stands since.
  - **The statuses are words of their own**, `QUEUED`, `WAITING_FOR_SLOT`, `WORKING`, `REPORTED`,
    `STOPPED`, `FAILED` and `INTERRUPTED`, from the latest run (`toSubagentStatus`), a refused run
    reading as failed. `endedAt` is `reportedAt`, which the ending that writes the report stamps
    however it ends.
  - **A stop asks by the subagent's `activeRunId`** (`RequestSubagentRunStopForAgent`, keyed), on a
    run queued, running or waiting, and is refused once that run chained, ended or was asked already,
    when the module reads again. A queued run is then ended at once (`StopQueuedSubagentRun`, fenced
    on the stop asked, with its note and report) and a promotion follows; a run waiting ends through
    `StopPendingSubagentRun`; a running one is its worker's. A subagent that has ended, or was asked
    to stop already, writes nothing, and a stop whose answer was lost is answered from its key, which
    also ends a waiting run it left asked to stop.
  - **What a subagent wrote** is what its successful module writes keep under its own scope,
    `conversation:<subagentId>`, since every write of an agent carries a key and only a write that went
    through keeps one, read oldest first by `createdAt` and key (`GetSubagentWritesForAgent`) with
    their `_count`, each naming the document or the task its result names by its tool. The list
    reads a conversation's live subagents whole, at most 100, and pages them in the backend.
  - **Whether a report was delivered** joins `list_subagents` with `reportDeliveredAt`, in M33.
  - **`readModuleCaller` is strict**, as Modules said it was: a field it does not know, or a
    launcher it did not write, is refused rather than dropped.
  - Verified: the four checks; `check:subagents-module`, `check:subagent-runs`,
    `check:conversation-runs`, `check:tasks-module` and `check:knowledge-module` against an emulator
    of the branch's schema, and `check:oauth` against the branch's backend; and the module's handler
    driven against that emulator as a running conversation's agent, under the placeholder: a launch
    queued and answered again from its key, its subagent run in process to its report, a running
    subagent stopped and reporting so, and both listed. Not yet: the real model, which reaches the
    tools in M33.

### M33: Subagents in conversations

- **The schema change**, additive: `ConversationRunTrigger` gains `REPORTS`, appended, and
  `Conversation` gains `reportDeliveredAt`, which `list_subagents` reads as whether each report was
  delivered, as M32 left it to.
- `CONVERSATION_MODULES` gains `subagents`, so the agent's list ends with its four tools, and the
  subagents' list leaves them out with `ask_user`. The worker fills the caller's launcher.
- **No deletes in subagents**, as David chose on 2026-10-16: `buildSubagentTools` leaves out
  `delete_document` and `delete_task` too, by name, so every subagent still sends one list, and the
  subagent's system prompt replaces "Delete a document only when the brief asks" and "or delete
  one" with deleting nothing and saying in its report what it would delete and why. A reaction
  deletes nothing either: `delete_document` and `delete_task` refuse a `REPORTS` run, reading the
  caller's launcher as `launch_subagent` does, with a sentence telling the agent to ask the member,
  and the conversation's prompt says to ask with `ask_user` before deleting what a report proposes,
  so the run the answer starts deletes it.
- **Taking up a task**, claimed before the launch (see Subagents § Taking up a task): the Tasks
  module's `update_task` gains an optional `fromStatus`, matched in its operation's `where` as the
  page's moves match theirs, an optional variable of its `…ForAgent` operation, refused with a
  sentence once the task has left that column, never retried as a position conflict is. The
  conversation's prompt takes a task up by moving it to `ONGOING` from the column it read it in,
  launches only once that move went through, launches nothing for a task whose move was refused,
  and moves it back, or says so, when the launch is then refused. The subagent's prompt never moves
  its task back, and moves it to `DONE` only when the brief says so, its report saying whether the
  work is done. The Tasks module's tools list moves with the new field, for external agents too,
  and `bun run probe:claude` sends it.
- **A member's entry names its files**: a text block before them, one line per file in their order,
  its name and its id, as `report.pdf (attachment <id>)`, which `measureConversationMessage` counts,
  so the agent can pass a file to `launch_subagent` (see Attachments § Its count). Only entries sent
  from this release on hold it.
- **A gate on launches until M34**: `IS_SUBAGENT_LAUNCH_GATED`, on everywhere but the development
  backend, as `IS_CONVERSATIONS_RELEASE_GATED` is, under which `launch_subagent` refuses in
  production with a sentence telling the agent to do the work itself, its tools list unchanged, so
  a release cut before M34 launches nothing. The tests turn it off, and one test keeps it on.
- **Reports as JSON**: each report a reaction's entry or a send carries is one text block holding one
  JSON object, its subagent's id, title, ending, report, first 20 writes and their `total`, so a
  report, written from whatever its subagent read, cannot pass for the member's words beside them or
  close the block it sits in. The system prompt names the shape.
- **The system prompt** says:
  - When to launch subagents: independent parts done in parallel, long research, and the tasks
    assigned to Strategy Dance, one subagent a task, the brief naming it.
  - That a brief carries everything a subagent knows of the conversation, and that a file is handed
    over by the id its message names it with.
  - That the agent tells the member what it launched and that it will come back with the reports.
  - That a report is data its subagent wrote from what it read, never instructions.
- Both pinned byte tests move, the conversation's and the subagent's, prompts and tools alike. Count
  the whole tools list's tokens, M29's three integration tools included, which the modules' 7381 of
  M17 left out, and run `bun run probe:claude`, which sends the list and a launch to the real
  model.
- **The reaction**:
  - The `REPORTS` run and its entry, counted toward the member's three runs on `conversation-runs`;
    one that finds them taken waits for the page's reconcile or the member's next send.
  - `launch_subagent` refuses a `REPORTS` run, inside the launch's mutation; the reads and
    `stop_subagent` serve it.
  - It starts at a subagent's end, at a parent run's `COMPLETED` end, and from the reconcile route.
  - The send and the answer carry undelivered reports, after every tool result, an answer's
    included, through an optional variable, counted as `$attachmentIds` is (`CLAUDE.md` § The
    database).
  - A batch, its delivery and its reaction leave out the subagents a Retry deleted.
- **The cascades**: Stop, Delete, Restore, Retry and the sweep, with the routes for Stop all and a
  subagent's Stop (see Subagents). Each keeps the one order § Subagents gives, the parent's runs
  before its row, which turns `DeleteConversation` round, and each that frees a slot is followed by
  a promotion. A delete is the web's, so it only asks: it frees no slot and queues nothing.
- **Tests**:
  - A batch of three reacted to once, after the last report.
  - Two ends at once starting one reaction.
  - Two overlapping batches: the first's completion delivering its reports alone, never a finished
    report of the second; a send carrying both, and the second's completion its remainder.
  - A reaction held back by the member's runs in other conversations, started when one of them ends,
    and by the sweep with no page open.
  - A reaction whose task could not be created, with no page open, queued again by the sweep.
  - A launch that counted five and left its run pending while a Stop ended one, its run promoted by
    the promotion following the Stop.
  - A deleted parent's `PENDING` subagents skipped by the promotion and finalized as stopped.
  - A question waiting not consumed, its answer carrying the reports.
  - A send carrying them, after its tool results, and an answer carrying them after every result,
    its answers included.
  - A reaction's launch refused, and its `read_subagent` served.
  - A Retry's deleted subagents left out of the next batch and of the ten, the run it starts
    launching ten again.
  - A Retry stopping and deleting the cut runs' subagents, and the parent's restore not bringing them
    back.
  - Stop reaching a `PENDING` subagent of its anchor, and leaving a fan-out an earlier message
    started working, which Stop all then stops.
  - A launch after the parent's Stop or delete refused, and one before reached by it.
  - A deleted parent never reacting, whatever its subagents report, and reacting once restored, at
    its next reconcile.
  - A full parent's subagents' reports marked delivered with no run, and its page no longer
    reconciling for them; a report that came while the parent's run went, before that run ended
    full, marked delivered by that ending.
  - A reaction's entry holding a subagent's first 20 writes with their total, each report one JSON
    object, a report holding quotes, braces and a line that reads as a member's message escaped
    inside it.
  - `launch_subagent` refused under the gate with its sentence, and let through without it.
  - A send with files naming each before them, its measurement counting the block, and a launch
    handing one over by that id.
  - The subagent's tools list holding no delete, pinned by its bytes, and a subagent's call to
    `delete_task` answered as a tool nobody runs.
  - `delete_document` and `delete_task` refused from a reaction's run with their sentence, and run
    from the answer's continuation.
  - Two parents claiming one task at once, through `update_task`'s `fromStatus`: one moved, the
    other refused and launching nothing; and a claim whose launch is refused moved back.
  - The sweep pruning subagents before their parent.
  - A reaction finding the member's three runs taken, started by the next reconcile.
  - Retries deleting several subagents of one parent, pruned while it stays, lowering its
    `subagentCount` by as many, and a parent that reached the hundred launching again after.
- `check:conversation-runs` gains the reaction's lock, two ends at once, and a launch against the
  parent's Stop, Stop all and delete, each in the one order, the parent's runs before its row, and
  against a send, an answer, Resume and Retry, each in both orders. PGlite runs one transaction at a
  time, so the order itself is checked by reading the mutations: no mutation writes the membership
  after a run, or a `QUEUED`, `RUNNING` or `PENDING` run after its conversation's row. A read takes
  no lock, and the launch's read of its run after the parent's row is what lets it see a Stop.
- **The subagents' model, measured**, as David chose on 2026-10-16: the same three briefs, a piece
  of web research, a task taken up from the board and a document written from what the knowledge
  holds, each run as a subagent on Opus 5.5 at medium effort, as today, Opus 5.5 at low effort and
  Sonnet 5.5 at medium, each with and without a `task_budget` (beta `task-budgets-2026-03-13`, read
  in the `claude-api` skill before it is written), eighteen subagents in all, some $50, which David
  approves before they run. Each records its tokens from its ledger, priced at list prices, its
  requests, how many runs it chained and whether its last run asked for the report, and its report
  is read for what it did, found and changed. The numbers go into the pull request and § Cost, and
  David chooses the model and effort from them, Opus 5.5 at medium staying until he does. A choice
  other than today's is a change of the subagent's request alone, its own constants beside
  `buildSubagentTools`, and M35's price table names the model it chose.
- **Verify** with the real model:
  - Ask the agent to take up three tasks assigned to Strategy Dance, one already `ONGOING`, and read
    the board, each task taken up moved to `ONGOING` before its subagent launched, the one already
    there left alone, and the reaction.
  - Brief a subagent whose work calls for a delete, and read its report proposing it, the reaction
    asking, and the run the answer starts deleting it.
  - Ask it to research two competitors at once.
- Built with these settled, on 2026-10-17:
  - **The reaction** (`reactToSubagentReports`) reads its parent whole (`GetSubagentReactionContext`),
    finds every waiting report of each complete batch (`findDueSubagentReports`), and starts its run
    in one write (`StartSubagentReaction`): the membership's lock and the three runs counted, the
    parent's row written under `activeRunId` null, no answer waiting and the run number read, its
    latest `COMPLETED` run checked after the lock, the run and its entry inserted, and exactly the
    reports it carries marked delivered, so a report a send delivered meanwhile refuses it, which
    reads again. Its entry is drawn as nothing. A subagent's end starts its parent's; any other run's
    end, the queued stop and the run's reconcile included, starts the member's oldest due
    (`startDueSubagentReactions`), its own conversation's first, until one starts or the three are
    taken; the subagents' reconcile route starts its parent's; the daily sweep
    (`sweepSubagentReactions`) starts every one due, member by member.
  - **Reports as JSON**: `{"subagentReport": {"id", "title", "ending", "report", "writes",
    "total"}}`, one text block each (`buildSubagentReportBlock`), the ending in `list_subagents`'
    words and the writes named as `read_subagent` names them (`toSubagentWrite`, shared).
  - **Delivery** goes through an optional `$deliveredSubagentIds` on `SendConversationMessage`,
    `SendConversationMessageAnsweringCalls`, `ContinueConversationRun` and
    `StoreConversationToolResults`, the last for the results entry an Allow's run stores, which
    carries them after the turn's results as an answer's entry does. Each is always called with the
    list, empty when nothing waits: the filter it drops when left out matches every report waiting,
    which its count then refuses. The send's and the turn's contexts read the reports waiting
    (`waitingReports`).
  - **A full parent**: its full ending is an operation of its own, `FinishConversationRunFull`, which
    marks the reports waiting delivered after the parent's row; a report that comes after is marked
    by whatever reads the parent full, the subagent's end, the reconcile or the sweep
    (`MarkSubagentReportsDelivered`, which writes the parent's row first and refuses once a run
    numbered after the full one exists). A report committing while the full ending runs, past what
    its update read, waits for the reconcile or the sweep to mark it, the narrow race no lock closes
    without writing the parent's row from a subagent's ending, against the one order.
  - **The deletes refuse a reaction** by reading the caller's launcher (`isReactionCaller`), loaded
    only for a call carrying one, so the Knowledge and Tasks modules' fakes load nothing new. The
    launch refuses one as it reads its launcher (`readSubagentLauncher`'s `isReaction`) and in its
    mutation (`trigger: { ne: REPORTS }`).
  - **Subagents get neither the deletes nor the Subagents module's tools**, by name (`isSubagentTool`),
    their runners filtered the same, so a call to one is planned as a call to a tool nobody runs.
  - **The launch gate** sits in `launchSubagentForAgent`, so the `launch:subagent` script, which
    launches through `launchSubagent` directly, never meets it. The tests open it with
    `mock.module('~constants', …)` in each file that launches through the module, and
    `launchGate.test.ts` keeps it closed.
  - **`fromStatus`** is checked against the task as each round reads the board, then matched in the
    write: a refused write is read again, and refused as `moved` once the task has left the column.
  - **The cascades**: the parent's Stop goes through new operations taking the stopped run's anchor,
    `RequestConversationRunStopWithSubagents` and `StopQueuedConversationRunWithSubagents`, since a
    required variable would break the old ones; Stop all and a row's Stop through
    `RequestConversationSubagentsStop`, whose anchor and ids each narrow it when given. Each is
    followed by `stopConversationSubagents`, which reads the subagents reached
    (`GetSubagentsToStop`), ends their queued and waiting runs at once, promotes, and asks again a run
    a chain swapped meanwhile. `RetryConversationRun` gains its steps without a variable: the live
    subagents on the retried anchor are exactly those the cut runs launched. `DeleteConversation` now
    writes the parent's runs before its row, then its subagents' runs and rows at its own instant, and
    `RestoreConversation` restores those deleted at that instant, read in its query step and matched
    through `response.query.deleted.deletedAt`, a `Timestamp` read back equal to the microsecond, as
    the emulator showed.
  - **The prune** claims a subagent only once no run holds it, reads claimed subagents first
    (`GetClaimedSubagents`) and deletes each parent's together, lowering its `subagentCount` by as
    many (`PruneClaimedSubagents`), then the parents, `GetClaimedConversations` leaving subagents out
    and a parent still holding one kept (`GetConversationsWithSubagents`). The sweep also reconciles
    every member's run past its lease (`sweepDeadConversationRuns`), a reaction's whose task was lost
    above all.
  - **The checks**: `check:subagent-runs` gains the reaction's, delivery's, the full ending's, the
    cascades' and the prune's operations, and a launch against a Stop, Stop all, a delete, a send, an
    answer and Retry in both orders, where the launch helpers live; `check:conversation-runs` reads
    the one lock order off the mutations themselves (`checkLockOrder`), which flags the old
    `DeleteConversation`.
  - **Data Connect refuses a variable an operation does not declare**, which the fakes let through:
    the measurement's dry run found two reads handed a run reference, fixed to pass the member alone.
  - **The tools list**, counted whole: 16017 tokens alone, the system prompt and the agent's own
    tools, M29's three integration tools included, 8727, the twenty module tools 9021, the four
    Subagents tools 1351 of them. Past the 10000 at which Later modules weighs Claude's tool search:
    whether it keeps some out is David's call.
  - **A subagent's request** carries settings of its own (`SUBAGENT_REQUEST_SETTINGS`, a model, an
    effort and a task budget), today's until David chooses; outside production the measurement sets
    others through the environment (`readSubagentRequestSettings`).
  - **The measurement**, cut by David on 2026-10-17 from eighteen subagents and some $50 to twelve
    short ones, a dollar each and $15 in all at most: three briefs on Opus 5.5 at medium and low
    effort, Sonnet 5.5 at medium, and Opus 5.5 at medium with a task budget of 50000, launched by
    `bun run measure:subagents` from parents whose own run never goes, each configuration back to
    back to share the cache. Measured on 2026-10-17, $0.57 in all, every subagent ending in one run
    without chaining or being asked for its report, in one to three requests and 6 to 32 seconds:

    | Configuration | Research | Task | Document | All three | Output tokens |
    | --- | --- | --- | --- | --- | --- |
    | Opus 5.5, medium (today's) | $0.116 | $0.025 | $0.032 | $0.173 | 2663 |
    | Opus 5.5, low | $0.101 | $0.018 | $0.026 | $0.144 | 1982 |
    | Sonnet 5.5, medium | $0.076 | $0.013 | $0.017 | $0.105 | 1962 |
    | Opus 5.5, medium, task budget 50000 | $0.094 | $0.021 | $0.032 | $0.147 | 2472 |

    The research is most of it: five searches and some 60000 to 78000 tokens of their results read
    from the cache, every other brief reading the 14226-token prefix the subagents share. Every
    research found Linear's Business plan at $16 a seat billed yearly and Notion's at $20; Sonnet's
    read both official pages, Opus's at medium and low effort relied on third-party pages for one or
    both, and the budgeted run's search came back after one query and it fell back on what it knew,
    the weakest. Every document brief created its five bullets and flagged the one it inferred, Opus
    tagging three aspects and Sonnet one. The task brief worked on one seeded task, so only the first
    configuration wrote its plan, and the three after found it there and rightly changed nothing: a
    flaw of the measurement, which compares their judgment on that brief rather than their writing.
    On briefs this short Sonnet 5.5 at medium costs 39% less than today's, Opus at low effort 17%
    less, and the task budget saves nothing measurable. David chooses from these numbers, Opus 5.5 at
    medium staying until he does.
  - Verified: the four checks; `check:subagent-runs`, `check:conversation-runs`,
    `check:subagents-module`, `check:tasks-module` and `check:knowledge-module` against an emulator
    of the branch's schema, and `check:oauth` against the branch's backend; `bun run probe:claude`,
    every check passing, Claude launching a subagent with a full brief through the whole list and
    taking a task up with `update_task` naming `fromStatus: TODO` first. With the real model, as
    M33 asks: three tasks assigned to Strategy Dance, one already `ONGOING`, the two in To do moved
    to `ONGOING` from `TODO` before their subagents launched, the third left alone, both reports
    delivered by one reaction that replied; a subagent briefed to clean up duplicated tasks deleting
    nothing and proposing the delete, the reaction asking with `ask_user`, and the run the answer
    started deleting the duplicate; and two competitors researched at once by two subagents, compared
    by the reaction.

### M34: Subagents in the thread

Not in the design: built from the design system's components, as Connected agents was.

- The `launch_subagent` row drawn as its subagent's (see Subagents), with `GetConversationSubagents`
  live and each working row's step through `GetConversationRun`.
- "View work" opens the dialog: the subagent's thread, read only and live, with its Stop. The
  conversation page sends a subagent's id to its parent's page with the viewer open
  (`?subagent=<id>`, validated as a string, as `CLAUDE.md` § Routing asks), through a bouncer under
  its waiter.
- The strip above the composer, "3 subagents working", with Stop all.
- Retry asks first when the runs it cuts launched subagents, naming how many it stops and discards
  (see Subagents § In the parent's thread).
- The page reconciles its subagents every two minutes while any is live, or a report waits
  undelivered while the parent could react to it (see Subagents § Recovery).
- `BRIEF` drawn at the top of a subagent's thread, its files as chips read through its
  `attachmentIds`, as M26 draws a message's.
- When reports wait undelivered and the parent cannot react, its last run stopped, failed, refused or
  interrupted, the strip says "2 reports waiting. Your next message delivers them." (see Subagents §
  In the parent's thread).
- Remove M33's `IS_SUBAGENT_LAUNCH_GATED`, and the test that kept it on, so production launches with
  the page that reconciles them.
- Strings in the `conversation` catalogue, the tools' labels among them, and `bun run translate`.
- **Verify** in a browser, on the conversation page and in a docked window, at desktop and phone
  widths: a fan-out of three, one stopped from its row, the others reported, and the reaction drawn;
  and a parent stopped while two report, the strip saying they wait, and a send delivering them.
- Built with these settled, on 2026-10-17:
  - **The reads**: `GetConversationSubagents`, live, its refreshes matching each write on the
    narrowest variable it carries, the subagent's own on the member and the organization, the
    parent's on its id; `GetConversationSubagentReport`, read as View output opens;
    `GetConversationBriefAttachments`, a brief's files among the parent's sent ones, its `$ids`
    required; `GetConversation`'s `parentId` and `subagentCount`, the bodies' and the history's
    `toolUseId` and `attachmentIds`, and `GetConversationRun`'s `anchorPosition`, all additive.
    `GetConversationRun` now wakes on the parent's stops of its subagents under the member's
    condition, a gap M33 left, since they name the parent. `check:subagent-runs` reads each as the
    member and as another.
  - **The row** (`ConversationSubagentCall`) is found by the call's `toolUseId`
    (`findConversationSubagent`), says where the subagent stands
    (`getConversationSubagentStatus`, following the backend's `toSubagentStatus`), its run's
    progress line while it works, through `useConversationRun` in a child mounted only then, and
    opens View output once it reported, however it ended.
  - **The viewer** (`ConversationSubagentViewer` on the page and in a dock's window, then
    `ConversationSubagentDialog`, `ConversationSubagentWorkWait` and
    `ConversationSubagentWorkBouncer`) draws the subagent's own thread, read only by its
    `parentId`. A subagent's address is sent on by `ConversationSubagentBouncer`, and
    `parseConversationSearch` reads `?subagent=`.
  - **The strip** (`ConversationSubagentsStrip`, from `getConversationSubagentsSummary`) is the
    composer form's first child, so it sticks with it, on the page and in the dock.
  - **The reconcile** (`useReconcileConversationSubagents`, from
    `getConversationSubagentsReconcileDelay`) asks after `CONVERSATION_REACTION_RECONCILE_DELAY_MS`
    once a batch, the subagents of one anchor, has reported whole while the parent could react, and
    every `CONVERSATION_SUBAGENTS_RECONCILE_INTERVAL_MS` while any is busy.
  - **Retry's question** (`ConversationRetryDialog`, from `countRetriedSubagents`) counts every
    subagent on the retried run's anchor, reported or not, as `RetryConversationRun` deletes them.
  - **Labels** for the four Subagents tools, and notes worded for a subagent in its thread.
  - Verified: the four checks; `check:subagent-runs` against an emulator of the branch's schema,
    every check passing; and in a browser against it, with the real model, some $1.23 at list
    prices for 22 runs, 31 requests and 24 searches. A fan-out of three, the Asana subagent stopped
    from its row and reported stopped, the Linear and Notion ones reported, the strip saying three
    at work with Stop all, and the reaction comparing both and saying the third was stopped. View
    output showing the launch's input and the report with its links; View work
    showing the brief, both searches and the reply, its address `?subagent=`, a search's output
    stacked over it and closed by one Escape, the viewer by a second, the address restored; a
    subagent's own address landing on its parent's page with its work open. The same on a phone, and
    in a docked window, where Escape closed the viewer and left the window. A parent stopped while
    its two subagents worked on an earlier message, which they went on with, the strip then saying
    one report waits, and the next send delivering it, the second subagent's reaction following.
    Retry after a launch stopped with its parent asking first, naming the subagent it discards, and
    the row gone once it retried. A brief handed a text file and an image, both drawn above it from
    the parent's files.

### M35: Usage caps

What the caps are, and why each rule below holds, is in Usage caps, as David chose on 2026-10-13,
with the account's ceilings, the cost limit a run and the ceiling on what finishes work under way
he added on 2026-10-16.

- `MAX_DAILY_CONVERSATIONS_PER_MEMBER` (20), `MAX_DAILY_CONVERSATIONS_PER_ACCOUNT` (40),
  `MAX_DAILY_CONVERSATIONS_PER_ORGANIZATION` (100), `MAX_DAILY_RUNS_PER_MEMBER` (100),
  `MAX_DAILY_RUNS_PER_ACCOUNT` (200), `MAX_DAILY_RUNS_PER_ORGANIZATION` (500),
  `MAX_DAILY_SUBAGENTS_PER_MEMBER` (30), `MAX_DAILY_SUBAGENTS_PER_ACCOUNT` (60) and
  `DAILY_CAP_OVERRUN_FACTOR` (1.5) in strategydance-core, with the six error codes, the member's, the
  account's and the organization's for conversations and for runs.
- **The schema change**, additive: `CappedStart`, its `id`, a UUID made by `uuidV4()` as
  `ConversationSearch`'s is, since no other field is unique, the member, the organization as a plain
  `organizationId: UUID!` rather than a reference, so deleting an organization keeps its rows for
  the account's counts until the sweep, its `kind`
  (`CONVERSATION`, `RUN`, `SUBAGENT`) and `createdAt`, indexed on the member, the organization, the
  kind and `createdAt`, on the member, the kind and `createdAt` for the account's counts, on the
  organization, the kind and `createdAt`, and on `createdAt` for the sweep, which deletes the rows
  over a day old beside the conversation searches.
- **The cost limit a run**, on the worker alone: `CLAUDE_MODEL_PRICES`, the list prices of each
  model a request can name, per million input, output, cache-read and cache-write tokens, beside
  `CONVERSATION_MAX_TOKENS`, and `priceConversationUsage`, which prices a run's ledger, each request
  settled or charged at its estimate, its web searches at $0.01, and its side requests with it.
  Before each request, where the lease's write reserves it, the run's price plus the request about to
  be reserved at the most it can cost, its whole input at the cache-write rate, as though the cache
  had expired, its output at the full `max_tokens` and five web searches, is held to
  `CONVERSATION_RUN_MAX_COST_MICRODOLLARS` ($10), the worst case recorded in the ledger by the write
  that reserves it and standing for every request whose billed usage is unknown, a takeover's
  included, rather than the estimate `chargeUnsettledRequests` charges for the credits, and covering
  a refusal's fallback, the second attempt at the costliest model the default fallback can route to,
  a request whose one attempt fits and whose two do not sent without `fallbacks`, and each of its
  five searches reserved as one more reading of the whole input and `WEB_SEARCH_RESULT_TOKEN_ALLOWANCE`
  for its results, the largest `probe:claude` measures with a margin, since what a search retrieves is
  billed as input within the request and nothing counts or caps it beforehand: past
  it, the run sends nothing more and ends `FAILED` with its limits' note, `isAtLimit` as at its
  other limits, and a subagent's run before its fourth chains, as M31 chains it at the other three.
  A model the table lacks fails the tests, rather than being priced at nothing.
- **The rows**: each mutation that starts what a cap counts inserts its `CappedStart`, a `RUN` row
  for every run triggered `MESSAGE`, `ANSWER`, `RESUME`, `RETRY` or `REPORTS`, `ContinueConversationRun`,
  M29's `ContinueConversationRunWithCalls` and a reaction's start among them.
- **The counts**, each reading the newest `CappedStart` rows, as many as one and a half times its
  cap, ordered by `createdAt` descending as `GetConversationSearchQuota` reads, the member's under the
  membership lock the mutation already takes, and the account's and the organization's without one:
  - `StartConversation`, the conversations and the runs;
  - `SendConversationMessage`, `SendConversationMessageAnsweringCalls`, `ResumeConversationRun` and
    `RetryConversationRun`, the runs;
  - the launch's mutation, the subagents, `launch_subagent` refusing past thirty, or the account's
    sixty, with a sentence saying when the member can launch again and to do the work itself
    meanwhile;
  - `ContinueConversationRun`, `ContinueConversationRunWithCalls` and a reaction's start, the runs,
    past one and a half times a cap alone.

  Each route counts first, so a refusal stores nothing, and answers 429 with `Retry-After`. A
  mutation a count refused reads the counts again, as `recordConversationSearch` does, to say which
  cap and when it frees.
  A continuation past one and a half times a cap is not refused: its answer or its Allow is recorded
  and the route answers 202 with no run, as when the member's three runs are taken, and the page's
  reconcile starts it once the window frees; a reaction past it waits undelivered for the next run
  end, reconcile or sweep that finds room. A route recognizes an action sent again before it counts,
  as it answers a retried send with the run its first try started, so a retry of a stored start is
  never refused.
- `IS_USAGE_CAPPED`, off on the development backend and on everywhere else, as
  `IS_CONVERSATIONS_RELEASE_GATED` is; the tests and the check script turn it on.
- The backend's `cors` exposes `Retry-After`, which a page of another origin cannot read otherwise,
  with a route test reading it.
- **The web**: `ApiError` carries `Retry-After`, and the composer and Resume's and Retry's note say
  which cap was reached and when it frees, keeping the draft, the composer's map of failures taking
  the new ones. Strings in the `conversation` catalogue, and `bun run translate`.
- `CLAUDE.md`: the caps, the cost limit, and that a new way to start a conversation or a run counts
  toward them, and a new model a request names joins `CLAUDE_MODEL_PRICES`.
- **Tests**:
  - Each cap refusing at its value and passing below it, the member's, the account's and the
    organization's, a member of two organizations counted in each apart, and an account at its
    ceiling across two organizations refused in a third.
  - A run priced past $10 by its next request ending with its limits' note before that request, its
    ledger's estimated requests counted, a subagent's run chaining there, and its fourth ending.
  - The reservation holding the bound when the cache has expired: a run at $8 over 700000 tokens
    refused its next request, which a cache hit would have kept under $10 and a miss would have
    taken to near $13.
  - A worker taking over a run whose request was reserved and never settled pricing it at its
    stored worst case, not at the estimate it charges for the credits, and refusing the next request
    that worst case leaves no room for.
  - A request near the limit whose fallback would pass it sent without `fallbacks`, its refusal
    ending the run with the refused note, and one with room for both sent with them.
  - A request whose input fits but whose five searches' allowance does not, refused before it is
    sent, which its retrieved input would otherwise have taken past $10.
  - An organization deleted after its member spent the account's allowance, and another created:
    the account still refused, its rows kept by their plain `organizationId`.
  - An answer loop stopped at one and a half times the cap: the answer recorded, no run started,
    and the reconcile starting it once the oldest row turns 24 hours old; an Allow the same; a
    reaction waiting past it and started by the next run end that finds room.
  - A deleted conversation and a retried run still counted.
  - A send retried at the cap after its first try was stored, answered with its run, not refused.
  - A subagent's runs counted toward no run cap.
  - An answer's continuation and a reaction starting past the cap, below one and a half times it.
  - A launch refused past thirty, and past the account's sixty across organizations, with its
    sentence.
  - `Retry-After` when the oldest of the newest rows, as many as the cap, turns 24 hours old, with
    the count past its cap.
  - A mutation refused after its route's count passed, reading the counts again for its refusal.
- `check:conversation-runs` gains the caps: two sends at once at the member's cap, one refused, and
  the account's count read across two organizations of one account.
- **Verify**: with the caps on locally and lowered, start conversations and send past them, and read
  each refusal in the composer and in Resume's and Retry's note, at desktop and phone widths.
- Built with these settled, on 2026-10-18:
  - **The development lift goes through the mutations.** A count's `@check` lives in SQL, which
    cannot read the backend's environment, so each capped mutation takes an optional
    `$isUsageCapped`, which only `false` lifts: left out, as a backend from before M35 or a forgotten
    call leaves it, the caps hold. The backend sends `IS_USAGE_CAPPED`, `!IS_DEVELOPMENT ||
    USAGE_CAPPED=true`, the second for trying them locally. Rows are inserted either way. The test
    kit's fixtures and the check scripts' helpers lift them, since they build past a cap to check
    something else, and the checks of a cap go through the domain or leave the variable out.
  - **The counts.** `GetCappedStarts` reads the eight lists a member's starts are counted in, the
    runs to one and a half times each cap, the conversations and the subagents to each cap, which is
    all a start's refusal needs to say when its cap has room; each mutation reads its own lists to
    the threshold it holds, a start to its cap, a continuation or a reaction to one and a half times
    it. `findReachedUsageCap` answers, of several caps reached, the one that has room last, since the
    start can go only then. A mutation the counts refused starts another round of its domain
    function, which reads them again and answers `capped`, or `waiting` for a continuation.
  - **The refusals.** A send, a start, Resume and Retry answer 429 with the cap's code and
    `Retry-After` (`respondUsageCapped`); a launch answers `tooManyToday`, whose sentence says when
    in minutes or hours; a reaction past one and a half times a cap answers `capped`, which stops a
    run's end from trying the member's other reactions, as `busy` does. The web keeps the time a cap
    frees on the draft (`failureRetryAt`) and words it relatively, moving on as the reader waits
    (`ConversationCapRefusal`), a run's cap as "Strategy Dance answered you 100 times", which reads
    for a send, a Resume and a Retry alike.
  - **The cost limit.** Each search's reading of the input again is priced at the cache-read rate,
    as David chose on 2026-10-18, the first reading having cached it within the request: at the
    cache-write rate no request past some 250000 tokens of context could be sent at all. A request
    of some 1200 tokens reserves about $2.34 alone and $5.25 with its fallback at Opus 5's prices, so
    a run drops the fallback past some $4.75 spent and ends past some $7.65; one at 700000 tokens
    reserves $6.53, ending the run past $3.47. A request whose stream failed partway counts at its
    worst case too, its output known only by the final delta, and one reserved before M35, with no
    worst case, at its estimate. Tagging that would pass the limit is recorded as a request skipped
    (`skipConversationRequest`, `stop_reason` `cost_limit`, no model), so the run tries it once all
    the same. A model the price table lacks is priced as the dearest and logged.
  - **The prices** sit beside the request's settings: Opus 5.5, Sonnet 5.5, Opus 5, Opus 4.8 and
    Sonnet 5, and `CLAUDE_FALLBACK_MODELS`, Opus 5.5's to Opus 5 and Opus 4.8 as the claude-api skill
    gave them, which `probe:claude` holds to the API's `allowed_fallback_models`.
    `measure:subagents` prices its subagents with them.
  - **The allowance** stays at a provisional 40000 tokens a search until `probe:claude` measures it:
    the probe now measures what each search of three research requests brings back past its readings
    of the input, and fails past the allowance, but could not run, gcloud asking David to sign in
    again before it reads the API key.
  - Verified: the four checks; `check:conversation-runs`, `check:subagent-runs`,
    `check:subagents-module` and `check:conversation-attachments` against an emulator of the
    branch's schema, every check passing, the caps' own among them: two sends at once at the
    member's cap letting one through, the account's 200 across organizations, one of them gone, the
    organization's 500 runs and 100 conversations, the window, the lift and the member's 30 launches.
    In a browser against it, with the placeholder agent and `USAGE_CAPPED=true`, the starts seeded
    near each cap: a new conversation past the 20 refused in a docked window's composer, and a
    response's Resume, its Retry and a send past the 100 runs refused under the note and in the
    page's composer, each saying when the cap has room and keeping the draft, at desktop and phone
    widths.

### M36: Integrations in subagents

As David chose on 2026-10-12, written again on 2026-10-16 against M29 as it merged (#171).

- **The tools.** `buildSubagentTools` gains `list_integrations`, `describe_integration_tool` and
  `call_integration_tool` after web search, in `CONVERSATION_TOOLS`' order less `ask_user`, so every
  subagent still sends one list; its pinned bytes move, and so do the subagent's prompt's, which says
  that only the tools `list_integrations` marks `runsWithoutApproval` run, and to say in its report
  what it would call with any other. Their runners are `createConversationIntegrationRunners`', closed
  over the subagent run's fence as a parent's are over its own, acting as the member, with their
  connections and the organization's keys, 30 seconds a call, a 401 alone marking the member's
  connection.
- **The decision**, made once, when the call is drawn, as M29 makes it
  (`decideConversationIntegrationCall`), from the server as it is then: refused, drawn failed with
  the server it named; run at once, when an administrator lets its tool run without approval, drawn
  running with its binding, checked again right before the call; and, for a subagent alone, a call
  that would wait for an approval drawn failed instead, never as an `APPROVAL`, its output "This call
  needs the member's approval, which nobody can give a subagent. Say in your report what you would
  call, with which arguments, and why." The decision takes whether the run is a subagent's, so a
  subagent never ends waiting, and the parent proposes the call in its own thread, where M29's
  approval applies.
- **Recovery** as M29's: a call that started is never made again, a `CONTINUE` run included, which
  answers it as interrupted, its result saying it may have run; a call drawn running that never
  started is made by the run that carries the subagent on, its binding checked again first, so a
  server changed while a chain waited refuses it.
- **What the parent hears.** `read_subagent` and a reaction's entry list a subagent's integration
  calls beside its module writes, each with its server, its tool and how it ended, since a call to
  another company's server is the one thing a subagent does that no restore undoes and nothing in
  the team's knowledge or board shows.
- **The switch's warning** on the Integrations page, `integration.toolsApprovalWarning`, says a tool
  that runs without approval also runs in subagents, which work with nobody watching, with `bun run
  translate`. Every approval given before M36 is staff's own, since everything stays staff only until
  M38, so none needs giving again.
- The viewer draws a subagent's failed call with M29's warning strip when its server is missing, off
  or not connected for the reader, its links leading to the Integrations page.
- **Tests**:
  - An auto-approved call running from a subagent, with its binding.
  - A call that would wait for approval drawn failed with its sentence, and the subagent completing.
  - A definition changed, a key replaced or a reconnect since it was drawn refused at the call, as
    M29 refuses it.
  - A started call answered as interrupted by the `CONTINUE` run, never made again.
  - Five subagents calling one OAuth server at once refreshing the member's token once, under the
    connection's lease.
  - `read_subagent` and a reaction's entry listing the calls made.
- **Verify** with the real model and DeepWiki added by its address: a subagent reading through a tool
  an administrator let run without approval, and one reporting a call it could not make, which the
  reaction proposes and the member allows.
- Built with these settled, on 2026-10-18:
  - **The calls the parent hears of are those that started**, `toolStartedAt` set, read by
    `GetSubagentIntegrationCallsForAgent`: a call refused as it was drawn, the one needing an
    approval among them, reached no server, and the report names it. Each is `{ integration, tool,
    ending }`, the names as they were at call time, its ending `SUCCEEDED`, `FAILED` (answered with
    an error), `UNANSWERED` (its server never answered, so it may have run) or `RUNNING`. A duration
    could not tell the last two failures apart, since a timeout has one, so a call is recorded as
    unanswered, `ConversationMessage.isToolUnanswered`, unless its failure says the server refused it
    before running it, its address, its credential, a refusal it answered or a status of 4xx but 408
    and 429: one that timed out, found no server or brought an answer that could not be read, too
    large or compressed, throws `IntegrationCallUnanswered`, whose sentence says to check before
    calling again, and so does one a crash interrupted, as Copilot pointed out over three rounds; a
    call cancelled by its run's end reads unanswered too, and one finished as
    interrupted before the column, by its missing duration. `read_subagent` lists them all with
    every page, `integrationCalls` and `integrationCallTotal`, at most 200 for a chain; a report
    names the first 20 with their total, after its writes, `{"subagentReport": {"id", "title",
    "ending", "report", "writes", "total", "integrationCalls", "integrationCallTotal"}}`.
  - **The conversation's system prompt moved too**, as David approved: it names the report's two new
    keys and asks the agent to make itself, with `call_integration_tool`, a call a report says its
    subagent could not make, when it still serves what the member asked, rather than first asking
    whether to, a reaction's run included, so the reaction draws it as an approval. Told only to
    propose it, the real model's reaction described the call and asked the member which way to go,
    a message before the Allow it could have drawn at once. With `read_subagent`'s schema, the
    conversation's tools' pinned bytes moved as well.
  - **The refusal** reads "Not called: this call needs the member's approval, which nobody can give a
    subagent. Say in your report what you would call, with which arguments, and why.", the prefix
    every refusal at drawing has, and the call is drawn failed with its server, so the viewer's strip
    says what fixes the server when it is off, missing or not connected.
  - **A subagent's runners** are the integrations' and its modules' but those it never gets, the
    integrations' closed over its own run's fence, so a call is started and finished under its
    attempt and its member's membership, as a parent's is.
  - **In the dock**, a subagent's viewer stayed open over the Integrations page once its strip's link
    led there, since the dock outlives the page: the window now closes it at the reader's next
    navigation (the router's `onBeforeNavigate`), a search alone changed or Back included, which
    covers a document's link in it too.
  - Verified: the four checks; `check:subagents-module`, `check:subagent-runs` and
    `check:conversation-runs` against an emulator of the branch's schema, every check passing, the
    new query's own among them: a subagent's started calls read in order with their status, duration
    and answer, one refused as it was drawn left out, a parent's left out, and somebody else's and a
    replaced membership reading nothing. In a browser against it, with the placeholder agent and a
    subagent's calls to DeepWiki drawn in its thread, the server turned off: the viewer drawing the
    failed call and the strip's Turn on at 1280 and 390 wide, on the page and in a dock window, where
    Turn on turned DeepWiki on and the viewer closed over the Integrations page, as it did opened on
    that page itself, staying closed on Back; and the switch's warning in the server's dialog.
    `probe:claude` on the real API, every check passing, a subagent's request with the integration
    tools among them; it also measured what a search brings back past its readings of the input,
    8729 tokens at most over three research requests, against M35's provisional allowance of 40000.
    On the real model, with DeepWiki added by its address on the Integrations page and
    `ask_wiki_question` alone let run without approval: a subagent listing the integrations, reading
    the tool and asking DeepWiki how the React compiler memoizes, its call drawn running and
    answered in 14 seconds, and the reaction's entry carrying it, `{"integration": "DeepWiki",
    "tool": "ask_wiki_question", "ending": "SUCCEEDED"}`; and a subagent told to use
    `read_wiki_structure` alone, which read the tool, saw it needs an approval, made no call and
    reported the call to make, with its arguments, which the reaction drew as an approval, the
    member allowed, and the answer's run made, the parent then listing the wiki's topics. Asked
    first, before the subagent was launched, the parent itself had warned that the tool needs an
    approval a subagent cannot get.

### M37: Launch readiness

What stands between a feature staff use and one anybody with an account can: who may start runs,
how staff stop an account or an organization that abuses them, what tells them something is wrong,
and the decisions left until there is usage to read, as David chose on 2026-10-16 (see Release gate
and Risks). It removes no gate: M38 does.

- **A verified email.** An account costs nothing to make, and a password sign-up names any address
  nobody has claimed, so the caps' allowance is tied to an address its owner confirmed. The
  conversation routes a member starts or continues a run through, the send, the answer, the
  approval, Resume and Retry, and the upload, refuse a caller whose ID token carries no
  `email_verified`, with 403 and `ERROR_CODE_EMAIL_NOT_VERIFIED`. A run already started, and the
  reconcile finishing one, are not refused. `authenticationMiddleware` keeps the claim on the viewer
  (`isEmailVerified`), and a middleware of its own, `verifiedEmailMiddleware`, mounted beside
  `staffOnlyMiddleware`, reads it. The composer says the address needs confirming and sends the link
  again, as `OrganizationInvitationUnverified` does, then mints a new token once it is confirmed
  (`refetch` on `AuthenticationContext`). The development backend
  lifts it, as it lifts the gates, since the Auth emulator confirms nothing by itself; the tests keep
  it.
- **Suspension.** `User.conversationsSuspendedAt` and `Organization.conversationsSuspendedAt`,
  optional timestamps nothing else writes. A suspended account, or any member of a suspended
  organization, is refused by every route the verified email guards, with 403 and
  `ERROR_CODE_CONVERSATIONS_SUSPENDED`, by `launch_subagent` with a sentence, and by the worker's
  claim, which checks it where it checks the staff role today (`runConversation`), so a queued run
  never starts. Set and lifted by `bun run suspend:conversations --production <email | organization
  id or slug> [--lift]`, in the backend's package, through a backend operation, run by staff by hand,
  which also asks every run of theirs in flight to stop, subagents' included, as Stop does, so
  nothing goes on past its next request: the one lever short of the workspace's
  spend limit, which stops every customer at once. The page says the account or the organization is
  suspended and to write to `david@strategydance.com`.
- **The micromark risk closed** (see Risks). Subagents read the web with nobody watching, so injected
  text reaching one is the likeliest way to make the agent write a shape micromark takes minutes on.
  `splitConversationText` parses with markdown-it, as `markdownToRichText` does, since it only needs
  where the top-level blocks start and end, keeping the cuts its tests pin today, with new tests on
  replies past the 20000 characters below which it parses nothing, 200000 characters of brackets and
  of list markers. The thread's `Markdown` stays on `react-markdown`, whose components the thread is
  built from, but first counts brackets and list markers in one pass, and draws a piece past the
  counts measured here, on micromark at a piece's 20000 characters, as plain text with its line
  breaks. A story shows both.
- **Capacity**, checked against the Anthropic organization's rate limit tier rather than assumed:
  the two queues dispatch 70 runs at once, 50 on `conversation-runs` and 20 on `subagent-runs`,
  which at a few thousand output tokens a request each has to fit the tier's input and output
  tokens a minute; the worker, at a concurrency of 4, needs 18 instances for them, within its
  service's maximum. Either queue's `max-concurrent-dispatches` is raised only as far as the tier
  holds, and Setup says what each is.
- **Alerts**, in Cloud Monitoring, mailed to `david@strategydance.com`: the worker's 5xx rate, the age
  of the oldest task on each queue, and the runs finalized as interrupted past a rate, read from the
  backend's log line for each. `bun run report:usage --production`, in the backend's package, sums
  the ledger of the last 24 hours as M35 prices it, by organization and by account, the subagents'
  runs apart, which is what the decisions below are read against. A deleted organization's runs go
  with it, `DeleteOrganization` cascading to their ledgers, so the report prints beside its total the
  workspace's own usage over the same 24 hours, read in the Anthropic Console, and calls the
  difference unattributed: deleted organizations' runs, development's and the probes', which read
  the same key (see Setup), and the gap between the ledger's estimates and what was billed. Metering
  that outlives a deletion is the credit system's to build, which this plan leaves to it. It also lists every request whose billed usage passed its
  reservation, which is what raises the searches' allowance.
- **The decisions left for the data**, each David's, taken with what `report:usage` and the
  recorded runs show, and written where each belongs:
  - the prompt cache's lifetime on the conversation's breakpoint, five minutes or an hour, from the
    pauses between a member's messages (see Cost);
  - whether web search keeps its filtering or sends `allowed_callers: ["direct"]`, which brings its
    citations back (see Drawing a turn);
  - the subagents' model and effort, if M33's measurement left it open;
  - the caps of M35 and the cost limit a run, against the recorded usage;
  - the rate limit tier, raised, the workspace's spend limit and the budget alert's threshold;
  - whether to list the modules in the MCP Registry, under the `com.strategydance` name a DNS record
    proves;
  - the legal page, reviewed for AI processing: naming Anthropic as processor, the region inference
    runs in (`inference_geo`), how long a conversation and its files are kept, and that what a
    member's connected agents read reaches those agents' providers, at the member's choice.
- `operations-costs.md`: Claude, Cloud Tasks and attachment storage, from the recorded usage,
  subagents' runs among them.
- **Tests**: each route refusing an unverified caller and a suspended account or organization, and
  passing once confirmed or lifted; the claim refusing a suspended run's member; `launch_subagent`'s
  sentence; `splitConversationText` on the long shapes past 20000 characters, which it would
  otherwise never parse; `Markdown` drawing a past-bound piece of 20000 as text.
- **Verify** against the emulators with the lifts off: an unverified password account refused and
  let through once its link is followed; an account suspended mid-run, its run stopping before its
  next request and a queued one never claimed, and lifted; and in production, before M38, `report:usage` read for the staff's own weeks.
- Built with these settled, on 2026-10-18:
  - **The suspension is read at the claim alone.** `takeStep` checks its author before it writes the
    turn a request came to, so a suspension read there would throw away a turn already paid for, and
    end the run interrupted rather than stopped. Both claims refuse it (`isClaimable`), and the runs
    already going stop through the stop the suspension asked for.
  - **The script runs one mutation, never the domain's Stop.** `stopConversationRun` and
    `stopConversationSubagents` start reactions and promotions, which a script, run with no
    `NODE_ENV`, would run in its own process against production. `SuspendUserConversations` and
    `SuspendOrganizationConversations` write the column and set `stopRequestedAt` on every run in
    flight of theirs, their own queued or running and their subagents' waiting for a slot too, in one
    transaction: a running one stops before its next request, a queued one is refused at its claim,
    and a waiting one is never promoted, the reconcile or the sweep ending it. The organization is
    found by its id or by its slug in two queries, since one filter on an optional variable left out
    would match every organization.
  - **Reactions wait, and the launch says why first.** Each reaction refused at its claim would leave
    an interrupted note and a run of the caps, so a suspended member's reports wait undelivered until
    the lift, and `startDueSubagentReactions` stops at the first. The launch reads the suspension
    before its launcher, which the suspension asked to stop, so the agent reads the suspension's
    sentence rather than the stop's.
  - **The page reads the suspension from the rows, the address from the token.** `GetCurrentUser`
    and `GetCurrentUserOrganizations` select the column, and a refusal for a suspension reads them
    again, since neither is live; the composer's notice reads `emailVerified`, the token's claim the
    backend reads, and against the emulators shows only once a send was refused for it. A file
    refused for either waits in the tray to go up again rather than leaving it.
  - **What micromark is slow on, measured.** Through `renderToStaticMarkup`, on the eleven shapes
    `markdownToRichText` is held to, at 20000 characters: quote markers opening one line took 678 ms
    at 1200 and 29 seconds at 5000, a run of asterisks or underscores overflowed the stack at 6000
    each side, and 6700 closing brackets or 13000 list markers took half a second. The limits,
    2000 brackets, 2000 list markers, 100 quote markers on one line and a run of 200, hold every shape
    under 200 ms, and a list of 400 links still draws as Markdown. markdown-it's block parsing takes
    all eleven at 200000 characters in well under a second.
  - **The queues' alerts read depth and attempt delay**: Cloud Monitoring has no age for a queue's
    oldest task. The worker's error rate leaves 503 out, which it answers by design for a run it
    holds. The interrupted runs are counted from a line `finalizeDeadConversationRun` logs, which
    nothing logged before.
  - **`report:usage` reads through the Admin SDK's own GraphQL**, never a connector operation, so it
    read production before this release: 7 runs from 2026-10-07 to 2026-10-15, $0.28, no subagent
    and no file, too little to set the caps or the cache's lifetime from. It was read through Data
    Connect's REST endpoint with gcloud's token, Application Default Credentials having expired.
  - **Capacity**: the rate limit headers say Evaluation tier, 80,000 output tokens a minute on Opus
    5.5, some twenty runs at once of the seventy the queues dispatch; output is counted as written,
    never from `max_tokens`. Setup 14 asks for the Start tier before M38.
  - **The decisions, David's on 2026-10-18.** The prompt cache keeps five minutes; subagents keep
    Opus 5.5 at medium effort; web search keeps its filtering, David leaving it to the session, since
    citations change the tools list and want the allowance measured again; the caps and the $10 limit
    stand, and David sets the workspace's spend limit and the budget alert; he asks for the Start
    tier; the modules go to the MCP Registry after launch; and the legal page is his to write, the
    points it names in Risks. The searches' allowance went from a provisional 40000 to 16000 tokens
    a search, against the 8729 the probe measured: a request of some 1200 tokens now reserves about
    $1.74 alone and $3.90 with its fallback, so a run drops the fallback past some $6.10 spent and
    ends past some $8.26, and one at 700000 tokens reserves $5.93, ending the run past $4.07.
  - **The alerts are in production**, created from this session with David's approval: the email
    channel, the log metric, which reads `textPayload`, where Cloud Run puts a JSON line's
    `message`, and the four policies of Setup 13.
  - Verified: the four checks; `check:conversation-runs`, `check:subagent-runs` and
    `check:subagents-module` against an emulator of the branch's schema, every check passing, the
    suspension's own among them. In a browser against it, a worktree backend started with
    `EMAIL_VERIFICATION_REQUIRED=true` and the placeholder agent, at desktop and phone widths, in a
    docked window and on the page: a password account's first send refused and the notice shown, the
    message kept in the field; the link sent, followed from the Auth emulator, and "I confirmed it"
    taking the notice away and letting the send through; `suspend:conversations` on the organization
    stopping the response going, its notice shown and a send refused, the field keeping it; then on
    the account, its own notice; and the lift taking either away. The `PastBound` story drawn from the
    built Storybook. A suspension's stop reads "You stopped this response", the stopped note's words,
    though staff stopped it: the notice beside it says why.

### M38: Launch

- Remove every release gate, by name, so none outlives the launch:
  - `ARE_CONVERSATIONS_STAFF_ONLY` and `ARE_MODULES_STAFF_ONLY` in strategydance-core;
  - the backend's `IS_CONVERSATIONS_RELEASE_GATED`, with `staffOnlyMiddleware` on the
    conversations' and the integrations' routes and the worker's claim's role check, and
    `IS_MODULES_RELEASE_GATED`, with `modulesStaffOnlyMiddleware` on the consent page's routes and
    the role check in `createAgentConnectionTokenVerifier`;
  - the web's `useCanUseConversations`, `useCanUseIntegrations` and `useCanUseModules`, the release
    bouncer in `$organizationSlug/conversations.tsx`, and the staff checks on the sidebar's item, its
    badge (`useConversationsAwaitingAnswer`) and the dock;
  - the tests that pin a gate, turned into tests that a member who is not staff passes.
- `CLAUDE.md`: a Conversations section with what a new tool needs, the transcript's rules and the
  run lifecycle, where earlier milestones have not written it, and the gates' paragraphs gone.
- **Verify** against the emulators, with the development backend's lifts off, as an account that is
  not staff: a conversation, a fan-out, an integration call, and an external agent connected through
  `check:oauth`'s flow; then the same in production once released. Before merging, everything M37
  left for David is decided.
