# Conversations: the milestones

The twenty-eight milestones that build the conversations feature, each one pull request into `dev`
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
  consent page, Connected agents and the module's dialog), registered app-wide
  in `_app.tsx`'s `APP_MESSAGE_TYPES` since the dock and the sidebar need it everywhere, and
  `bun run translate` runs whenever one changes. No em dash in a message.
- Web files: `components/conversation/`, `hooks/conversation/`, `utils/conversation/`,
  `contexts/ConversationDockContext.ts`. One concern per file, a waiter above the bouncer that reads
  its data, waiters keyed on the organization's id, no `useMemo` or `useCallback`.
- Backend files: `routes/conversations.ts` (mounted at `/organizations/:organizationId/conversations`
  with `mergeParams`), `routes/internal.ts` (mounted by the worker service only),
  `middleware/organizationMember.ts`, `middleware/staffOnly.ts`,
  `middleware/conversationSearchRateLimit.ts`, `domain/conversations/`, `domain/agent/`; for the
  modules, `modules/` (one folder per module), `domain/knowledge/`, `routes/oauth.ts` (mounted at
  `/oauth`), `routes/modules.ts` (mounted at `/mcp`), `domain/oauth/` and
  `middleware/moduleRateLimit.ts`.
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
M3 from the start, M13 as soon as M1 has merged, M16 as soon as M14 has, and M12, M22 and M25 well
before their neighbours.

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
| M9 | Claude replies, with web search | backend, database, web | M6; M8 to reach production | |
| M10 | Stop, resume, retry, failures and refusals | backend, database, web | M7, M9 | |
| M11 | Questions | backend, database, web | M10 | |
| M12 | Searching conversations | backend, database, web | M8, M9 | |
| M13 | Rich text, Markdown and shared documents on the backend | design-system, backend | M1 | |
| M14 | The Knowledge module | database, core, backend, web, root | M12, M13 | |
| M15 | Knowledge in conversations | backend, database, web | M10, M14 | |
| M16 | The authorization server | backend, database, core, root | M14, setup 10 | |
| M17 | The consent page and Connected agents | web, backend, database, root | M16 | |
| M18 | The Knowledge module for external agents | backend, web, root | M17 | |
| M19 | Mentioning knowledge in the composer | web | M7, M15 | |
| M20 | Team, log and top priority tools | backend, database, web | M9, M13 | |
| M21 | Aspect tagging, suggestions and the aspect page section | backend, database, core, web | M7, M9 | |
| M22 | The dock | web | M7 | |
| M23 | Attachments: storing them and sending them to Claude | backend, database, root | M8, M9, setup 7 | |
| M24 | Attachments in the composer and the thread | web | M19, M23 | |
| M25 | Integrations: the organization's servers | database, backend, web | M8, setup 9 | |
| M26 | Integrations: members connect their accounts | database, backend, web | M25 | |
| M27 | Integrations in conversations | database, backend, web | M11, M26 | |
| M28 | Launch | all | all | |

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
  M23, the approval fields for M27, and `@searchable` for M12: each is additive, so each release
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
  bouncer: search param `isNew` validated (`aspect` in M21), and
  `beforeLoad` refusing an id that is not one, as `knowledge.$documentId.tsx` does; a
  `ConversationOrganizationBouncer` copied from `KnowledgeOrganizationBouncer`, back to the list when
  the organization changes; waiters keyed on the organization's id; `useConversation` and
  `useConversationRun`.
- The page: the bar, the title, the aspects button (on saved conversations: a draft's aspects arrive
  in M21, sent with its first message); `KnowledgeDocumentAspectsDialog` generalized into an
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
- `POST …/messages`, body `{ messageId, text }` for now (later milestones add a draft's aspects,
  suggestion and attachments), validated on the server: `text` trimmed, not empty (M23 allows that
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
  folders (M23), and deleted integrations with their credentials (M25). The prunes done on the way
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
  conversation shows full rather than failing every request (M23 adds the files' stored counts).
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
  pieces held in memory that take it past the limit stop it too; a conversation near the limit
  whose tools list grew in a release counted with the growth, and stopped by it.
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

### M11: Questions

- `ask_user`, its `QUESTION` messages, and `WAITING` runs with their `pendingToolResults`.
- `POST …/answers` with `{ messageId, selected, other }`, serialized on the waiting run as The
  transcript describes, and skipping on send. The answer is checked against its stored question
  before anything is recorded, since it goes into Claude's transcript: `selected` holds distinct
  options of that question only, at most one for a single-choice question; `other` is one trimmed
  line of at most 500 characters (`MAX_ANSWER_OTHER_LENGTH`); an answer chooses at least one option
  or writes something; and a single-choice answer is exactly one of the two, an option or its own
  words, as the radios draw it.
- The question's waiting state in the thread, "Needs your answer" in the list and on cards, the
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
  the subset, with tests: round trips of all four styles, underline through `<u>…</u>` included,
  alone and nested in the others; another tag kept as literal text; nesting, check items, links,
  what degrades to paragraphs, lengths against `MAX_DOCUMENT_CONTENT_LENGTH`.
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
  revision race checking its key again before it reapplies; a create in a full organization refused;
  a 200000-character document read in pages that join back whole, and one made of a single
  200000-character paragraph too; a page asked for after somebody typed elsewhere carrying on from
  its block, one after an edit inside the block it stopped in starting that block again, and one
  whose block was deleted starting the document again; a fold refused on a moved revision read again
  and reapplied, and a push landing during a fold left pending; a block range replaced between two
  ids without touching the rest, and refused once one of them is gone; an append and a replacement
  that would take the document past 200000 characters of content refused, its text and its pending
  updates left as they were, and the same on a retry after somebody else's fold; a unique piece of
  text replaced inside that paragraph, and a text that occurs twice refused; search reading the
  index and loading the plain text of 20 candidates at most; a fold through the old operations
  nulling `contentText`, and the next search reindexing it; a Chinese and a Japanese search finding
  a word inside a document's sentence, reading the content of the 100 latest documents at most;
  Markdown in, the document draws as written; an `update_document` naming `content` and `append`
  together, or nothing to change, refused before anything is read; the list paged in fifties, two
  documents updated at one instant on either side of a page's end neither skipped nor repeated;
  aspects replaced, and a repeated one refused; a delete refused when AI may read but not change,
  and when it may change but not read; a restore at the cap refused, and one past a day refused; an
  external caller's results carrying addresses, by its id for an organization without a slug, and
  the agent's none; a caller without the write scope refused by every write tool, nothing written;
  an argument past its schema's bound, a 101-character query say, answered as an `isError` result
  the model can read, as the SDK turns a failed input validation into one; a removed member's call
  refused, and so is one carrying the `membershipCreatedAt` of a membership since ended, after the
  member was invited back.
- Verify: with `bun run mcp:knowledge` added to Claude Code locally, search, list and read; with a
  document open in a tab, have Claude Code write into it and watch the edit arrive while you type
  elsewhere in it, your caret staying put; create one, tag it, delete it and restore it; turn Write
  off on one and ask again; turn Read off on it and ask about it.

### M15: Knowledge in conversations

The agent's knowledge, through the module, in process (see Modules § Strategy Dance's agent).

- The worker's module client: for each run, the Knowledge module's server for the run's member
  (`kind: 'agent'`, every scope, the run's `membershipCreatedAt`, the scope `conversation:<id>`), an
  SDK `Client` pinned to the 2026-07-28 revision and connected to the module's handler through a
  transport whose `fetch` is `(url, init) => handler.fetch(new Request(url, init), { authInfo })`,
  the caller as `authInfo`, and its tools converted and appended after the built-in ones. Reads run
  four at a time, writes alone, each keyed with its `tool_use` id.
- Recovery as A run § Recovery and side effects says: a worker taking over, and Resume, call a
  module write again with its key; finalizing an interrupted run, and a send answering it, read
  each started write's key first, recording a stored result as `SUCCEEDED` and answering the rest
  as interrupted calls that may have run. The conversation prune deletes its `ModuleCallResult`
  rows by their scope.
- The tools' labels in the `conversation` catalogue, running and done, and `bun run translate`;
  the system prompt's knowledge section.
- In the thread, `doc:` links resolve against the organization's live document list: the current
  title, or struck through when deleted. A `delete_document` row offers Restore, through
  `RestoreDocument`, while the document is deleted and the day has not passed.
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

### M16: The authorization server

Strategy Dance's OAuth server on the public backend, as Modules § External agents describes it,
with nothing to authorize yet but a script: the consent page comes in M17 and the endpoint in M18.

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
- The token verifier M18 mounts: one read by the token's hash, of an unexpired access token alone,
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
  address, when its body was cut, or when it redirects; a registration with an `https` redirect or a
  private-use one such as `cursor://` refused, and a loopback one accepted; a loopback redirect
  matching on any port, and every other one exactly; an error before the client is checked rendered
  and never redirected, and one after it redirected with `state` and `iss`; a success redirected
  with `code`, `state` and the exact `iss`; `resource` missing, repeated or naming no module
  refused, scopes past the module's refused, and the write scope without the read one refused;
  approving read and write for a client that asked for read refused, and a request for read and
  write reduced to read, its token answer's `scope` saying read alone; a token request missing
  `resource`, or naming another than its code's or its refresh token's, refused; an exchange missing
  its `client_id` or its `redirect_uri`, or naming another client or address than its code's,
  refused, and a refresh from another client than its token's refused; a `plain` challenge and a
  wrong verifier refused; a code used twice refused, the second use revoking what the first issued,
  and a code past its minute refused; a token for one module refused for another; a refresh
  rotating; the spent token presented again within 30 seconds answered with the very pair its first
  use issued, however many times and in whichever order the answers return, and presented after 30
  seconds revoking the connection; the two successors of one spent token differing; a duplicate
  across a rotation of the secret, served by an instance holding the newer version, answered with
  the first use's pair; consenting again replacing the earlier connection and its tokens, and two
  approvals at once for one client, organization and module leaving one connection; Allow sent twice
  making one connection and one code, an Allow racing a Deny deciding the request once, and a denied
  request refused by a later Allow; a code presented again revoking the tokens it issued and leaving
  another connection's alone; approving refused for an account that is not staff and for an
  organization it is not in; removing the member deleting the connection with its tokens; a revoked
  token refused; an access token presented to the refresh grant refused, and a refresh token to the
  verifier; every token answer carrying `Cache-Control: no-store` and `Pragma: no-cache`;
  `response_type` missing, repeated or other than `code` refused; `grant_type` missing, repeated or
  unknown refused, and a code exchange carrying a refresh token's parameters reading none of them; a
  revocation naming another client than the token's refused, the connection left as it was.
- Verify: `bun run check:oauth` against the local stack; `/security-review` on the branch before it
  merges, as Risks asks.

### M17: The consent page and Connected agents

- The `module` message type, for the consent page, Connected agents and M18's dialog, its module
  and its `MESSAGE_TYPES` entry, registered on the consent page's route and in `_app.tsx`'s
  `APP_MESSAGE_TYPES`, and `bun run translate`.
- `/oauth/consent`, as Modules describes it: under `_authenticated` and outside `_app`'s frame, so a
  signed-out member signs in and comes back through the page `AuthenticationBouncer` keeps; read
  through `GET /oauth/requests/:requestId`; the client, the module, an organization chosen among the
  member's, the access, read and write offered only when the client asked for both, Allow and Deny,
  the module and its access worded from the `module` catalogue by the module's name; an expired or
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

### M18: The Knowledge module for external agents

- Dependencies: `@modelcontextprotocol/node`, for `toNodeHandler`, and
  `@modelcontextprotocol/express`, for `requireBearerAuth` and `mcpAuthMetadataRouter`.
- `routes/modules.ts`, mounted at `/mcp` on the public backend only: `POST /mcp/knowledge` through
  the module's handler from M14, mounted with `toNodeHandler` and handed the parsed body as its
  third argument, `(request, response) => nodeHandler(request, response, request.body)`, behind
  `requireBearerAuth` with M16's verifier and the endpoint's address as `expectedResource`; the
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

### M19: Mentioning knowledge in the composer

- The "+" menu (with "Mention knowledge" only until M24), the `@` list and its keyboard handling,
  mentions sent as `[Title](doc:<id>)`, all as The composer describes.
- Verify: mention two documents, send, see the links in the bubble and the agent read them; mention
  one with Read off and see the agent say it cannot read it.

### M20: Team, log and top priority tools

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
  that `$date`, computed from the member's time zone, is their today, all beside the fenced run
  write and the call's result, so a crash leaves the priority set once or not at all. Its
  `$organizationId` matches `GetOrganizationTeam`'s refresh, so an open Today page updates at once.
- Verify: "What is everybody working on?", "What did I log this week?", and "Make shipping the
  pricing page my priority": the Today page updates without a reload, and the build in public streak
  counts the day once the page is reloaded (`GetActivityDays` is not live).

### M21: Aspect tagging, suggestions and the aspect page section

- The tagging side request and its note, as The agent describes.
- The suggestion catalogue: `CONVERSATION_SUGGESTION_IDS` in core (keys like
  `STRATEGY_ONE_METRIC`), the 36 titles and openers in the `conversation` catalogue.
- The conversation route's `aspect` and `suggestion` search params, validated; the aspects button on
  a draft, held in the draft until it is sent; the first message's draft fields (`aspects`,
  `suggestionId`, `title`, `opener`); the opener inserted in the first send's one mutation, at
  position 0 before the member's message, so the first send stays atomic and a retry finds it whole;
  in the transcript, the suggestion carried in the first user entry, never as an assistant entry
  (see The agent).
- The aspect page's Conversations section above Knowledge, as designed, through
  `useAspectConversations` (`GetAspectConversations`), and "New conversation"
  tagged with the aspect.
- Verify: a new conversation about pricing gets tagged; set aspects before sending and it does not;
  start a suggestion and see it leave the cards.

### M22: The dock

- `_ConversationDockProvider` in `router.tsx`'s `Wrap` after `CurrentOrganizationProvider`, with its
  context and `useConversationDock`. Windows are persisted with `usePersistedState` under one literal
  key, holding a map keyed by `${userId}:${organizationId}`, since neither is known when `Wrap`
  mounts.
- The dock in `AppLayout`, inside `SidebarProvider` after `SidebarInset`, `z-40`, hidden on mobile
  and on the conversation page: windows, read through `useDockConversations`
  (`GetDockConversations`, only the conversations its windows hold), the "+N" menu, focus, Escape,
  unread counts and `MarkConversationRead` while a window is open, drafts in windows, and "Open in dock" on the list,
  the page and the cards.
- Toasts move out of the dock's corner app-wide (Sonner's `position`), checked on a screenshot.
- Utilities with tests: how many windows fit.
- Verify: open four conversations at several widths; minimize, close, full page; replies arriving in
  minimized windows count up; a phone width has no dock.

### M23: Attachments: storing them and sending them to Claude

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
  by the sweeper, and one a row names kept; a conversation marked full.
- Verify: with a script, upload an image, a PDF and a text file, send them, read the reply.

### M24: Attachments in the composer and the thread

- The "+" menu's "Files and images", paste, the tray with upload progress and a remove button
  calling `DELETE …/attachments/:attachmentId`, image shrinking, the budget's message; the thread's thumbnails fetched from `GET …/attachments/:attachmentId` with the
  caller's tokens and shown as object URLs, file chips, the image dialog.
- Verify: attach each type from the composer and ask about it; add and remove thirty files and
  attach again; reach the conversation's budget.

### M25: Integrations: the organization's servers

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
  bumps the integration's `configRevision`, a counter M27's pending approvals are bound to.
- The server dialog lists its tools with a switch each for running without approval. A tool's
  `readOnlyHint` is shown beside it as the server's own claim, which may suggest a choice, never make
  one: the MCP specification calls annotations untrusted.
- Backend routes for administrators: add (connects with `@modelcontextprotocol/client`, the SDK
  M14 installed, over Streamable HTTP and lists the tools), edit, delete, turn on and off, retry.
  An OAuth server answers 401 before any member has connected, so adding one runs only its
  discovery here, the protected resource metadata and the issuer it names, and its tools wait for
  the first connection in M26: until then the dialog says to connect an account to list them, and
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
  guarded. OAuth discovery and token requests (M26) use the same guard.
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

### M26: Integrations: members connect their accounts

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

### M27: Integrations in conversations

- The three integration tools; calls with the member's own connection or the organization's key,
  30 seconds each; `lastUsedAt`; a 401 marks the connection as needing authentication.
- **The schema change**, additive, with `APPROVAL` appended to the kinds: `ConversationMessage` gains
  `integration` (an optional reference, nulled if the server is pruned), `integrationName` (at call
  time), `integrationToolName`, `approvalState` (`PENDING`, `ALLOWED`, `DENIED`), `approvalConfigRevision`,
  `approvalToolHash` and `approvalCredentialGeneration` (see below), and
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

### M28: Launch

- Remove the release gate everywhere, and `ARE_CONVERSATIONS_STAFF_ONLY` and
  `ARE_MODULES_STAFF_ONLY`.
- `CLAUDE.md`: a Conversations section with what a new tool needs, the transcript's rules and the
  run lifecycle, where earlier milestones have not written it.
- Whether to list the modules in the MCP Registry, under the `com.strategydance` name a DNS record
  proves, which is David's call.
- `operations-costs.md`: Claude, Cloud Tasks and attachment storage, from the recorded usage.
- Before merging: the rate limit tier raised, the spend limit and the budget alert's threshold looked
  at again against the recorded usage, and the legal page reviewed for AI processing, naming
  Anthropic as processor and the region inference runs in, and saying that what a member's
  connected agents read reaches those agents' providers, at the member's choice, which are David's
  calls.
