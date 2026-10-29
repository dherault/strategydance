# strategydance-backend

The backend's conventions, beside the root `CLAUDE.md`. What its features do and why is in
[conversations.md](../../documents/conversations.md), for conversations, modules, OAuth and
integrations, and [budget.md](../../documents/budget.md): read the one for what you change first.
This file keeps the rules a change must keep.

## Code

One router per resource in `routes/`, Express middleware in `middleware/`, what a route does in
`domain/`, the modules' servers in `modules/`, helpers in `utils/`, one concern per file. Imports go
through the aliases of `tsconfig.json`, which Bun reads at runtime.

- The app's routes answer core's `ApiResponse` envelope, every refusal going through `respondError`
  with an `ERROR_CODE_*`. The OAuth protocol's routes and the modules' endpoints answer and
  authenticate as their protocols ask, as [OAuth and integrations](#oauth-and-integrations) says
- No body parser runs app wide: an app route parses its own, then runs `appCheckMiddleware`,
  `authenticationMiddleware` and `validateMiddleware`, and reads its caller with `readViewer`. A
  route taking a file parses it last, after whatever says the caller may send it
- Rich text, its Yjs helpers and its Markdown come from the design system's `lib/`, never a
  component, with `yjs` at the design system's range, since the helpers test types by `instanceof`
- A domain function hands an operation only the variables it declares: Data Connect refuses one it
  does not, which the fakes let through
- Every fake database mirrors the operations a `check:*` script runs against the emulators: an
  operation changed is changed in both
- Load the `claude-api` skill before writing code that calls Claude

## Services

`createApp` (`src/app.ts`) builds two services from one image: the public `strategydance-backend`,
and the private `strategydance-worker` (`SERVICE=worker`), which mounts `routes/internal.ts` at
`/internal` and nothing else. A route Cloud Tasks or Cloud Scheduler calls goes there: Cloud Run's
invoker check admits `conversation-tasks@strategydance.iam.gserviceaccount.com` alone, so no internal
route verifies a token.

- Both run as the Compute Engine default service account, which holds, the organization withholding
  Editor, `roles/run.builder`, `roles/firebasedataconnect.dataAdmin`, `roles/storage.objectAdmin` on
  the bucket, `roles/cloudtasks.enqueuer`, `roles/cloudtasks.viewer`, `roles/iam.serviceAccountUser`
  on `conversation-tasks`, `roles/cloudkms.cryptoKeyEncrypterDecrypter` on the integrations' key and
  Secret Manager's accessor on each secret it reads. Anything new it reaches needs a role granted by
  hand
- The backend goes public through `--no-invoker-iam-check`, never `--allow-unauthenticated`, whose
  `allUsers` the organization refuses: each route's middleware guards it
- Secrets are read through `retrieveSecret`, cached for the process, or `retrieveSecretVersion`
- `dev:backend` runs on the emulators without App Check, and lifts the caps, the ceilings and the
  confirmed address unless started with `USAGE_CAPPED=true` and `EMAIL_VERIFICATION_REQUIRED=true`

The worker's schedules:

- `POST /internal/sweep`, daily, syncs the exchange rates, reconciles runs, then prunes what stays
  deleted past its Undo window or expires, each step running whatever failed before it
  (`runSweepSteps`). Anything kept deleted, or counted, for a while adds its idempotent prune there
- `POST /internal/runs-reconcile`, every five minutes, reconciles the runs no page watches, and a
  new kind of run no page watches is reconciled there too
- `POST /internal/directories-check`, daily, commits the check to one rolling pull request through
  a GitHub App ([directories.md](../../documents/directories.md)). It runs the last release's code on
  `dev`'s lists, so `readDirectoryLists` refuses a field or value it does not know

## Storage and the outside

- `storage.rules` grants clients nothing under `organizations/`: the backend writes what only an
  administrator or a member may store. A picture of a document's text goes only with its
  organization, since an undo or another tab can bring a deleted one back
- A conversation's file and a bill's receipt have no download token: the backend serves them to
  members alone. An object is written create-only, every id in its name canonical
  (`toCanonicalUuid`). An upload reads files back one at a time (`runUploadReadBack`), then
  `Bun.gc(true)`, or twenty of 10 MiB pass Cloud Run's 512 MiB: run `bun run
  load:conversation-attachments <email>` after changing what an upload reads, holds or sends
- The Storage emulator applies no rule and ignores generation preconditions: code relying on
  `ifGenerationMatch: 0` reads what is there first, and its tests simulate the 412
- A request to an address somebody gave goes through the outbound guard in `utils/`, never `fetch`:
  `requestOutbound`, `fetchOutbound`, or `createGuardedFetch` for the MCP SDK, to public addresses
  alone. A refusal or a log names the origin alone, never a path, a query or what a server answered
- Every email goes through `sendEmails` (`domain/email/`), over Resend, from
  `david@strategydance.com`, which stays verified there and receives the replies. Only production
  sends: elsewhere the HTML lands in the OS temp directory and an invitation's link in the log
- Claude's Files API workspace is shared by development and production, so every file is named with
  `CLAUDE_FILE_NAME_PREFIX`, and production's sweep alone deletes those no row names
- `finalizeDeadConversationRun` logs `DEAD_RUN_LOG_PREFIX`, which a log metric's filter matches: its
  words change with the filter

## OAuth and integrations

- The authorization server (`routes/oauth.ts`, `routes/wellKnown.ts`, `domain/oauth/`) answers
  OAuth's own JSON (`respondOAuthError`), without App Check, to any origin without credentials
  (`OAUTH_PROTOCOL_PATHS`). It never logs a body, finds tokens by their hash and meters callers.
  The consent page's routes keep the app's middleware, and alone fetch a client's metadata
- A module's endpoint (`routes/modules.ts`) answers JSON-RPC, without App Check, checks its bearer
  token with `createAgentConnectionTokenVerifier`, and parses the body only once the token is
  verified
- An organization's MCP servers are its administrators' (`routes/integrations.ts`), and nothing is
  saved for a server that cannot be reached. Keys are encrypted, with Cloud KMS in production, bound
  to their organization and server
- Members connect at OAuth servers through `createIntegrationFetch` and the MCP SDK's
  `registerClient`, `startAuthorization`, `exchangeAuthorization` and `refreshAuthorization`, never
  its `auth()`. A token goes to the address of the revision it was given for alone. Nothing logs a
  code, a state or a token
- Tests run on `createOAuthDatabaseFake`, `createIntegrationDatabaseFake` and the real SDK against
  `createIntegrationOAuthServerFake`. `bun run check:oauth` walks the flow against the local
  backend, `check:integrations` checks the operations, `probe:integrations` reaches every catalogued
  server

## Conversations

Runs:

- The loop is the worker's own, never the SDK's tool runner, since a run stops for an answer and
  writes each step as it happens. A lease is set on the database's clock (`leaseExpiresAt_time`)
- `activeRunId` names a conversation's run exactly while it is `QUEUED`, `RUNNING` or, a
  subagent's, `PENDING`. Every write that ends a run lets go of it where it still names the run,
  never filtering on `deletedAt`, and cancels the calls still `RUNNING`, in the same mutation
- Every write of a worker is fenced: its first step updates the run, matching `RUNNING`, its claimed
  `attempts` and its author's membership `createdAt`, and is the run's only write in the mutation,
  its end, step and lease riding in its data
- Every limit, the run's and the member's daily ceilings, is checked before a request, never after,
  so a turn paid for is stored and drawn. A worker reads the suspension as it claims a run
  (`isClaimable`), never after, and a start that must not commit for a suspended member reads it
  after the membership's lock
- A new way to start a conversation, a run or a subagent counts a `CappedStart` in its mutation,
  after the membership's lock, and reads the caps (`readReachedUsageCap`) and the ceilings
  (`readRunSpendRoom`) first, answering 429 through `respondUsageCapped`. Its route, as any route
  that spends on Claude for a member, mounts `organizationMemberMiddleware`,
  `verifiedEmailMiddleware`, then `conversationsSuspensionMiddleware`
- A model a request names or falls back to joins `CLAUDE_MODEL_PRICES` and `CLAUDE_FALLBACK_MODELS`
  before it ships. Every write of `usage` upserts the run's `RunSpend`, and a side request of a run,
  as the aspects' tagging is, goes through its ledger with its `purpose`
- A new way to end a member's run starts their due subagent reactions (`startDueSubagentReactions`),
  and one ending a subagent's run that held a slot promotes after it (`promoteSubagentRuns`)

Transcript and thread:

- Every request is built by `buildConversationRequest` and passes `checkTranscript`, and the entry
  answering a turn comes from `buildConversationToolResults`. The transcript is append-only but for
  Retry, its JSON in `String` columns, never `Any`, so it replays byte for byte
- The system prompts and the tools are pinned by their hash: a change costs every conversation its
  earlier reasoning once, so it ships with a release that means it, and `bun run probe:claude` runs
  after
- A drawn message's id derives from what it draws (`deriveConversationMessageId`), and its position
  is claimed on `nextMessagePosition` under `@check(this == 1)`
- A subagent is hidden from its member: every read or count of a member's conversations filters
  `parentId: { isNull: true }`, and every way a member acts on one refuses a subagent, in the domain
  and in the mutation
- Every write on a parent and its subagents locks the membership, the parent's runs, the parent,
  its subagents' runs, then their rows, each step reading its lock's response
- A file a member sends is uploaded before its message, under a `conversationId` nothing reserves,
  so every lookup, count and prune of `ConversationAttachment` also matches `userId` and
  `organizationId`
- A search's query travels in the body, never the address, and is never logged
- A knowledge write carries the text twice, so it is measured first (`isKnowledgeWriteTooLarge`),
  and refused rather than written without its revision

A new tool takes:

- a description saying when to call it, labels in `getConversationToolLabel`, a JSON result within
  `MAX_TOOL_RESULT_LENGTH`, a long read paging itself, and a failure answered `is_error: true` with
  a sentence the model can act on, never one failing the run
- `eager_input_streaming: true`, its input checked before it runs, and whether it only reads, which
  a module says with `readOnlyHint`
- a place in `isSubagentTool` when it deletes or reaches subagents
- its bytes pinned: the tool lists' tests move with it, and `probe:claude` runs after. The agent's
  own tools are strict, within the API's 20 strict tools, 24 optional and 16 union parameters

Integrations reach the agent through three fixed tools, so the list never varies with them. A call
is decided once, as it is drawn (`decideConversationIntegrationCall`), and a call that started is
never made again: one cut off is finished as interrupted.

Tests run on `createConversationDatabaseFake`. `bun run check:conversation-runs`,
`check:subagent-runs` and `check:conversation-search` check the operations against the emulators,
and `check:conversation-races` races a run's mutations on a real Postgres, never in CI: run it
before a release that changes them.

## Modules

A module is a capability served as an MCP server, to Strategy Dance's agent in process and to
members' own agents at `/mcp/<name>` (conversations.md § Modules).

- Its server lives in `src/modules/<name>/`, built by `create<Name>Server(caller)`, one file per tool
  calling `domain/<name>/`. `MODULES` in core lists it, and the web's `module` catalogue words it
- A tool's name is snake_case, unique across the modules and the agent's own tools, and a module's
  registration order is frozen. A tool takes a zod input and an `outputSchema`, answers through
  `toToolResult`, refuses through `toToolRefusal`, never a protocol error, and carries
  `readOnlyHint`, `destructiveHint` and `openWorldHint: false` as they apply
- The caller arrives verified (`readModuleCaller`), never from arguments, and every operation
  matches its membership's `createdAt`. Only a worker's caller has a `launcher`
- A write checks the write scope before reading anything, and inserts its `ModuleCallResult` first
  under the call's idempotency key (`com.strategydance/idempotencyKey` in `_meta`)
- Its operations are `…ForAgent`, holding to the AI permissions, each write named in the refreshes
  of the live queries whose rows it changes
- A module served to external agents is in `SERVED_MODULE_NAMES`, takes `requireModuleWriteScope`
  on every write, its searches on the member's allowance, `ModuleAgentsButton` on its page and its
  endpoint in `check:oauth`
- Tests drive it through `createModuleTestKit` on `createModuleDatabaseFake`, which a new module's
  fake joins. A tool reaching the conversation runtime or the bucket imports it inside its handler.
  `bun run check:<name>-module` checks the operations

## Budget

- Money is a whole number of a currency's minor units within `MAX_MONEY_MINOR`, a day `YYYY-MM-DD`,
  and core computes what the page and the module show
- The budget is an administrator's, written with every variable. Agents never change it
- A bill's limits are core's, repeated in its operations' checks. Every save marks the receipt the
  bill held with the bill (`formerBill`)
- A receipt goes through `billReceiptStorage`, replaced in tests by `createAttachmentStorageFake`.
  An upload never carries on a reservation over a day old, which the sweep may be pruning
- Strategy Dance's agent names a receipt by a conversation's `attachmentId`, which only a caller with
  a launcher may: a new way to take a conversation's file into a module goes through the launcher
  the same way
- A request held to a schema takes a branch of its own in the placeholder agent. The receipt
  reader's usage is logged, never written to a run's ledger
- Tests run on `createBudgetDatabaseFake`, and `bun run check:budget` and `check:budget-module` check
  the operations

## Scripts

`bun run <script>` in this package, some from the root too, against the emulators unless given
`--production`. Those reaching Claude cost money, unless `CONVERSATION_AGENT=placeholder` is set.

| Script | What it does |
| --- | --- |
| `check:<area>` | Checks an area's operations against the emulators, which CI does not run: run it after changing one |
| `probe:claude` | Sends Claude the agent's real request and checks what only the model confirms. Run it after an SDK bump, a change of model, price or tools, never in CI |
| `send:conversation <email> [--conversation <id>] [--file <path>]… <text>` | Sends a message through `dev:backend` and prints the conversation's address |
| `launch:subagent <email> --conversation <id> [--count <n>] <brief>` | Launches subagents as the module does, printing each report |
| `measure:subagents` | Prices briefs run as subagents on each model weighed, capped at $15 in all |
| `mcp:knowledge <email>`, `mcp:tasks <email>`, `mcp:budget <email>` | A module over stdio, as that account, for `claude mcp add … -- bun run mcp:knowledge <email>`. Over HTTP, the local backend serves `http://localhost:3003/mcp/<name>` |
| `seed:budget <email>`, `sync:exchange-rates` | Fills an organization's Budget; syncs the ECB's rates, which the emulators need once |
| `check:directories` | Runs the directories' check, about $0.10 a directory, into this checkout or, with `--publish`, the pull request |
| `emulators:postgres` | The races' stack, four emulators on one Postgres, until Ctrl-C |
| `suspend:conversations`, `report:usage` | Staff's suspension of an account's or organization's conversations, and what conversations cost |
| `backfill:document-text`, `backfill:task-text`, `backfill:task-done-at` | Run once with `--production`, by hand, after the release that added each |
