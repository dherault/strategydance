import {
  DEVELOPMENT_API_PORT,
  DEVELOPMENT_API_URL,
  DEVELOPMENT_APP_URL,
  INTEGRATION_CONNECTED_PATH,
  PRODUCTION_API_URL,
  PRODUCTION_APP_URL,
  SERVED_MODULES,
} from 'strategydance-core'
import type { TaskStatus } from 'strategydance-database/backend'

/* ---
  ENVIRONMENT
--- */

// Set by the package's `dev` and `start` scripts, so a process started any other way is neither
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development'

export const IS_PRODUCTION = process.env.NODE_ENV === 'production'

// Cloud Run tells the container which port to listen on, and nothing else does
export const PORT = Number(process.env.PORT) || DEVELOPMENT_API_PORT

/*
  Whether this process is the worker rather than the backend: the same image, which
  `deploy:backend` deploys a second time as `strategydance-worker` with `SERVICE=worker`. The
  worker serves the internal routes, which Cloud Tasks and Cloud Scheduler call, and nothing else,
  and the backend everything but them
*/
export const IS_WORKER = process.env.SERVICE === 'worker'

/*
  Whether the daily caps hold in this process (`MAX_DAILY_…` in strategydance-core), which every
  mutation that starts a conversation, a run or a subagent is told through `isUsageCapped`: they
  guard spend, so everywhere, staff included, but on the development backend, where placeholder runs
  cost nothing and a developer starts dozens. `USAGE_CAPPED=true` holds them there too, to try them.
  The tests and the check scripts keep them. Rows are counted either way
*/
export const IS_USAGE_CAPPED = !IS_DEVELOPMENT || process.env.USAGE_CAPPED === 'true'

/*
  Whether a member starts or continues a run only once their ID token says their address is
  confirmed (`verifiedEmailMiddleware`): an account costs nothing to make, and the daily caps'
  allowance is an account's, so it is an address its owner confirmed. Everywhere but the development
  backend, whose Auth emulator confirms nothing by itself, as the gates are lifted there.
  `EMAIL_VERIFICATION_REQUIRED=true` holds it there too, to try it. The tests keep it
*/
export const IS_EMAIL_VERIFICATION_REQUIRED = !IS_DEVELOPMENT || process.env.EMAIL_VERIFICATION_REQUIRED === 'true'

/* ---
  ARCHITECTURE
--- */

// Named rather than discovered, since a local run has no metadata server to ask
export const FIREBASE_PROJECT_ID = 'strategydance'

// The project's default bucket, the one the web app's config names too
export const FIREBASE_STORAGE_BUCKET = 'strategydance.firebasestorage.app'

// The project's number, which a Cloud Run service's address carries
export const GOOGLE_CLOUD_PROJECT_NUMBER = '995028545701'

// Where both services, the run queue and the database run
export const GOOGLE_CLOUD_REGION = 'us-central1'

/*
  The worker's address, Cloud Run's deterministic one, `<service>-<project number>.<region>.run.app`,
  known before the worker is first deployed, so the backend can be deployed ahead of it. It is also
  the audience of the token a task carries, without a path: Cloud Run checks it against its own
  addresses
*/
export const WORKER_URL = `https://strategydance-worker-${GOOGLE_CLOUD_PROJECT_NUMBER}.${GOOGLE_CLOUD_REGION}.run.app`

/*
  The Cloud Tasks queue every conversation's run is delivered through, created by hand (Setup 4 in
  `documents/conversations.md`): 5 attempts at most, 90 seconds' backoff at least, 50 deliveries at
  once
*/
export const CONVERSATION_RUN_QUEUE_PATH = `projects/${FIREBASE_PROJECT_ID}/locations/${GOOGLE_CLOUD_REGION}/queues/conversation-runs`

/*
  The Cloud Tasks queue a subagent's run is delivered through instead, to the same worker route,
  created by hand (Setup 11 in `documents/conversations.md`): 5 attempts at most, 90 seconds' backoff
  at least, 20 deliveries at once, so a few fan-outs of forty minutes never hold the deliveries every
  member's reply waits on
*/
export const SUBAGENT_RUN_QUEUE_PATH = `projects/${FIREBASE_PROJECT_ID}/locations/${GOOGLE_CLOUD_REGION}/queues/subagent-runs`

// Who Cloud Tasks and Cloud Scheduler call the worker as, the one account granted the invoker role
// on it. The project's owners and `deployer` can call it too, as they can any service there
export const CONVERSATION_TASKS_SERVICE_ACCOUNT = 'conversation-tasks@strategydance.iam.gserviceaccount.com'

/*
  Where a Storage download URL points: the emulator when `dev:backend` set its host, as the Admin
  SDK itself decides, and Firebase's download host otherwise. The URLs this server writes into the
  database start here, so a development row points at a development file
*/
export const STORAGE_DOWNLOAD_ORIGIN = process.env.FIREBASE_STORAGE_EMULATOR_HOST
  ? `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`
  : 'https://firebasestorage.googleapis.com'

// Where the links this server writes into emails lead
export const APP_URL = IS_PRODUCTION ? PRODUCTION_APP_URL : DEVELOPMENT_APP_URL

/*
  Which pages may call this server from a browser: the app's own domain, the two Firebase Hosting
  gives every site, and the preview channel deployed for a pull request, which is a production build
  and so calls the production server.

  Development answers any origin, which covers the dev server on 5173 and `bun run preview` on
  5050 alike. Nothing here relies on cookies, so reflecting an origin grants nothing a request
  does not already carry in its own token
*/
export const ALLOWED_ORIGINS = IS_PRODUCTION
  ? [
      PRODUCTION_APP_URL,
      'https://strategydance.web.app',
      'https://strategydance.firebaseapp.com',
      /^https:\/\/strategydance--[a-z0-9-]+\.web\.app$/,
    ]
  : true

/* ---
  REQUESTS
--- */

// A UUID as a route takes one: Data Connect writes it as 32 hex digits and reads it with or without
// hyphens, so a caller may send either. `toCanonicalUuid` gives the one form an id is kept in
export const UUID_PATTERN = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

// Who is asking when this server fetches a page somebody else named, for a site that answers bots a
// page of its own: a link preview's, and a directory's check
export const OUTBOUND_USER_AGENT = 'Mozilla/5.0 (compatible; StrategyDanceBot/1.0; +https://strategydance.com)'

/* ---
  CONVERSATIONS
--- */

/*
  How often a worker renews its run's lease while it writes nothing else, and how often it writes a
  progress line at most. Every write of a worker renews the lease for a minute, which the
  operations set from the database's clock
*/
export const CONVERSATION_RUN_RENEWAL_INTERVAL_MS = 20 * 1000
export const CONVERSATION_RUN_STEP_INTERVAL_MS = 1000

/*
  Whether a conversation's run goes in the backend's own process, after the response, as it always
  does in development, where nothing throttles it. In production it goes through the run queue to
  the worker instead: Cloud Run throttles the CPU once a response is sent, which would stall a run
  left going, while a task's request stays open for the whole run
*/
export const ARE_CONVERSATION_RUNS_IN_PROCESS = !IS_PRODUCTION

/*
  Whether conversations are answered by the placeholder client rather than Claude: in development
  only, when `CONVERSATION_AGENT=placeholder` spares a developer what every request to the real
  model costs. Production always asks Claude
*/
export const IS_CONVERSATION_AGENT_PLACEHOLDER = !IS_PRODUCTION && process.env.CONVERSATION_AGENT === 'placeholder'

/*
  What every file the backend uploads to Claude's Files API is named after, before the attachment's
  id: never the member's own name for it. Development and production read the same API key, so they
  share one workspace, and its listing holds both: production's sweep deletes the files no row names
  only under its own prefix, so it never touches a developer's
*/
export const CLAUDE_FILE_NAME_PREFIX = `strategydance-${IS_PRODUCTION ? 'production' : 'development'}-`

// How long a task's delivery may take, the run it delivers going the whole time: as long as the
// worker's own timeout, which `deploy:backend` sets
export const CONVERSATION_RUN_DISPATCH_DEADLINE_SECONDS = 15 * 60

/*
  A run's own limits, beside the entries it draws: at most 25 requests to Claude, and none started
  once 10 minutes have passed since it was first claimed. A request already streaming then has until
  14 minutes, when its stream is cut, so the run ends with its note within the task's 15-minute
  delivery
*/
export const CONVERSATION_RUN_MAX_REQUESTS = 25
export const CONVERSATION_RUN_MAX_DURATION_MS = 10 * 60 * 1000
export const CONVERSATION_RUN_STREAM_DEADLINE_MS = 14 * 60 * 1000

/*
  A run's cost limit, $10 in microdollars, as David chose on 2026-10-16, since a cap on starts
  bounds nothing a single run spends: before each request, the run's ledger priced at list prices,
  each request it has no answer for at the worst case its reservation recorded, plus the most the
  request about to be sent can cost, is held to it. A run past it sends nothing more and fails with
  its limits' note, and a subagent's run before its fourth chains, so a subagent costs $40 at most
*/
export const CONVERSATION_RUN_MAX_COST_MICRODOLLARS = 10_000_000

/*
  How many input tokens one web search may bring back, which a request is reserved for beside each of
  its five searches: what a search retrieves is billed as input within the request, and nothing
  counts or caps it beforehand. The largest `probe:claude` measured, with a margin: the one part of
  the cost limit that rests on a measure rather than a proof, raised from what a request billed
  past its reservation, which `bun run report:usage` lists. The probe measured at most 8729 tokens a
  search over three research requests on 2026-10-18, and David set it at 16000 that day, from a
  provisional 40000
*/
export const WEB_SEARCH_RESULT_TOKEN_ALLOWANCE = 16_000

// How often a worker reads whether its run's member asked to stop it while a request streams. It
// reads it before each request too
export const CONVERSATION_RUN_STOP_CHECK_INTERVAL_MS = 2000

/*
  How a run rides out Claude's API failing for a while, once the SDK's own two retries are spent: a
  request refused before its stream started, as rate limited (429), overloaded (529), failing (5xx)
  or unreachable, which costs nothing, is sent again up to four times in a row, after what the
  answer's `retry-after` asks, at most a minute, or after five seconds doubled at each failure, while
  the run's ten minutes allow it. Past that the run fails with its note, as any other failure of the
  API does. The Evaluation tier's output tokens a minute refuse requests past some twenty runs at once
  (Setup 14 in documents/conversations.md), which a member would otherwise meet as a failed run
*/
export const MAX_CONVERSATION_API_RETRIES = 4
export const CONVERSATION_API_RETRY_DELAY_MS = 5000
export const CONVERSATION_API_MAX_RETRY_DELAY_MS = 60 * 1000

// How long the request that tags a conversation with its aspects may take before it is cut, and the
// conversation is left untagged: a few seconds at low effort, so a minute is a request gone wrong
export const CONVERSATION_TAGGING_TIMEOUT_MS = 60 * 1000

/*
  How long one of Strategy Dance's own tools may take on a call, and how many calls that only read
  run at once, side by side: a call past its time fails, and whatever it answers later is dropped.
  A call that writes runs alone, so writes land in the order Claude made them
*/
export const CONVERSATION_TOOL_CALL_TIMEOUT_MS = 60 * 1000
export const CONVERSATION_READ_CALLS_AT_ONCE = 4

/*
  How long a queued run's lease is, which only says when to ask Cloud Tasks whether its task is still
  coming: every write that queues a run sets it, and the one that finds its task there pushes it back
  as far, each writing it out in its mutation, which this mirrors for the tests' fake. Short of the
  window below, so a run whose task never came, its process gone between storing it and queueing
  it, is found and queued again while it is young, by its page or by the worker's reconcile every
  few minutes for a run no page watches, a subagent's or a reaction's
*/
export const CONVERSATION_RUN_QUEUED_LEASE_MS = 2 * 60 * 1000

/*
  How long after a run was queued a route that finds its task gone queues it again, rather than
  finalizing the run as interrupted: ten of a queued run's leases. A task that could not be queued,
  or was lost, is queued again while the member still waits on its page, which asks every two
  minutes, or the worker's reconcile finds it, and a run whose task keeps going missing ends once it
  is older
*/
export const CONVERSATION_RUN_REQUEUE_WINDOW_MS = 20 * 60 * 1000

/* ---
  MODULES
--- */

/*
  The revision of the Model Context Protocol the modules are served and reached at: stateless, with
  no `initialize` handshake. Strategy Dance's agent pins it, since both ends are Strategy Dance's
*/
export const MODULE_PROTOCOL_VERSION = '2026-07-28'

/*
  Where a module's write takes its idempotency key, in the call's `_meta`, since MCP has none of its
  own, and how long one may be. Written out again in each `…ForAgent` write's check: change them
  together
*/
export const MODULE_IDEMPOTENCY_KEY_META = 'com.strategydance/idempotencyKey'
export const MAX_MODULE_IDEMPOTENCY_KEY_LENGTH = 200

// Where the public backend serves the modules strategydance-core's `SERVED_MODULES` lists, each at
// its `MODULES` path
export const MODULES_PATH = '/mcp'

/*
  The most a call to a module's endpoint carries, 1 MiB, past a document's 200000 characters
  escaped as JSON; how many calls one connection makes in ten minutes, one a second on average,
  which an agent reading a long document in pages and editing it stays well short of; and how many
  refused calls one address makes in ten minutes, before its token is read. Both counted in the
  instance's memory, as the backend's other limits are
*/
export const MAX_MODULE_REQUEST_BYTES = 1024 * 1024
export const MAX_MODULE_REQUESTS = 600
export const MAX_REFUSED_MODULE_REQUESTS = 600
export const MODULE_REQUEST_WINDOW_MS = 10 * 60 * 1000

// How long an external agent's call results are kept for its retries. Strategy Dance's agent's last
// as long as their conversation, so a Resume however late still finds them
export const MODULE_CALL_RESULT_LIFETIME_MS = 24 * 60 * 60 * 1000

/*
  The Knowledge module's bounds. A search answers at most 10 documents, of at most 20 candidates
  whose plain text is loaded to cut an excerpt around a matched word, and says when more matched.
  Before it reads the index it indexes up to 20 documents a page from before `contentText` left
  unindexed. A list pages in fifties
*/
export const MAX_KNOWLEDGE_SEARCH_RESULTS = 10
export const MAX_KNOWLEDGE_SEARCH_CANDIDATES = 20
export const KNOWLEDGE_SEARCH_EXCERPT_LENGTH = 240
export const MAX_KNOWLEDGE_DOCUMENTS_INDEXED = 20
export const KNOWLEDGE_LIST_PAGE_SIZE = 50

/*
  How much of a document's text one read answers, in characters, each block counted with its id
  and the JSON around it, so a page stays short of the 50000 characters a tool result is cut at
  while a document holds 200000
*/
export const KNOWLEDGE_READ_PAGE_LENGTH = 40000

// How many times an agent's edit is applied to a document whose snapshot somebody folded more into
// meanwhile, read again each time, before the module gives up
export const KNOWLEDGE_FOLD_ATTEMPTS = 3

/*
  How much Markdown a document's revision keeps for a member to look at: twice a document's
  content, which `FoldDocumentWithRevisionForAgent` and `RestoreDocumentRevision` hold it to, since
  Markdown escapes what would read as Markdown and can run a little longer than the text it writes
*/
export const MAX_DOCUMENT_REVISION_MARKDOWN_LENGTH = 400000

/*
  How large a write of a document's text may be, its variables as JSON in UTF-8: short of the 4 MiB
  Data Connect takes in a request, gRPC's own bound, which the emulator names when a fold carrying
  its revision beside the new snapshot passes it, with room for the rest of the request
*/
export const MAX_KNOWLEDGE_WRITE_REQUEST_BYTES = 4000000

/*
  A member's reads of what a conversation's edits can undo and their restores of a document's
  revisions, each of which merges a whole document's text in the instance: at most 20 documents a
  read, the latest edited first, and 60 reads and restores in 10 minutes, counted in the instance's
  memory as the pictures' uploads are
*/
export const MAX_UNDOABLE_REVISION_DOCUMENTS = 20
export const KNOWLEDGE_REVISION_RATE_LIMIT = 60
export const KNOWLEDGE_REVISION_RATE_WINDOW_MS = 10 * 60 * 1000

/*
  The board's columns, left to right, as the web's `TASK_STATUSES` lists them: the order the Tasks
  module lists a board in, column by column. Strings rather than the enum's values, which a test
  holds to the schema's, so reading them loads nothing of the database's
*/
export const TASK_STATUSES: readonly `${TaskStatus}`[] = ['BACKLOG', 'TODO', 'ONGOING', 'DONE']

/*
  The Tasks module's bounds. A list answers at most 100 tasks and 40000 characters of JSON a page.
  A read answers at most 45000, each list of links cut at 20 with its count, short of the 50000
  characters a tool result is cut at, as is a move to Done naming the first 50 tasks it frees. A loop
  refused names its first 20 tasks. Before a query it indexes up to 20 tasks a page from before
  `descriptionText` left unindexed. An update lost to another write is read again and reapplied, three
  times at most
*/
export const TASK_LIST_PAGE_SIZE = 100
export const TASK_LIST_PAGE_LENGTH = 40000
export const TASK_READ_LENGTH = 45000
export const TASK_READ_LINKS = 20
export const MAX_FREED_TASKS_NAMED = 50
export const MAX_LOOP_TASKS_NAMED = 20
export const MAX_TASKS_INDEXED = 20
export const TASK_UPDATE_ATTEMPTS = 3

/* ---
  OAUTH

  Strategy Dance's authorization server, which external agents a member connects to a module go
  through (`documents/conversations.md`, Modules, External agents)
--- */

/*
  The issuer, which the metadata, the endpoints and every module's address hang off: the backend's
  own domain in production, and the development backend otherwise, at `API_URL` when a worktree
  runs one on another port, so the addresses it names are the ones it answers on
*/
export const OAUTH_ISSUER = IS_PRODUCTION ? PRODUCTION_API_URL : (process.env.API_URL ?? DEVELOPMENT_API_URL)

// Where an authorization sends the browser for the member's consent, `?request=<id>` after it
export const OAUTH_CONSENT_URL = `${APP_URL}/oauth/consent`

/*
  The protocol's own endpoints, which answer any origin without credentials, since no cookie is
  involved and no client could otherwise call them from a page: the metadata, the authorization
  server's and each served module's protected resource metadata (RFC 9728), registration,
  authorization, the token endpoint and revocation, and the client ID metadata document Strategy
  Dance presents to an organization's MCP servers. Every other route answers the app's origins
  alone, the consent page's and the modules' endpoints included. Matched exactly, as Express routes
  them, ignoring case and one trailing slash
*/
export const OAUTH_PROTOCOL_PATHS = [
  '/.well-known/oauth-authorization-server',
  ...SERVED_MODULES.map(module => `/.well-known/oauth-protected-resource${module.path}`),
  '/oauth/register',
  '/oauth/authorize',
  '/oauth/token',
  '/oauth/revoke',
  '/integrations/oauth/client',
]

/*
  How long each thing the server hands out lasts: an authorization request awaiting the member's
  consent, the code Allow issues, an access token and a refresh token. Written out again in the
  operations that set them, which cannot import them: change them together
*/
export const OAUTH_AUTHORIZATION_REQUEST_LIFETIME_MS = 10 * 60 * 1000
export const OAUTH_CODE_LIFETIME_MS = 60 * 1000
export const OAUTH_ACCESS_TOKEN_LIFETIME_MS = 60 * 60 * 1000
export const OAUTH_REFRESH_TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000

/*
  How long after its rotation a refresh token presented again is answered with the pair its first
  use issued, as by a client whose answer was lost or two refreshes at once. Presented later, it
  revokes the connection. Written out again in `GetAgentConnectionRefreshToken`: change the two
  together
*/
export const OAUTH_REFRESH_GRACE_SECONDS = 30

/*
  What anybody can make the server store before a member has signed in: registrations, 1000 a day
  in all, and authorization requests, 1000 in ten minutes in all, beside what one address may make.
  Written out again in `CreateOAuthClient`'s and `CreateOAuthAuthorizationRequest`'s checks: change
  them together
*/
export const MAX_OAUTH_CLIENT_REGISTRATIONS_PER_DAY = 1000
export const MAX_OAUTH_AUTHORIZATION_REQUESTS = 1000

/*
  How long a parameter of an authorization may be, a client's id, its redirect address or its
  `state`, and how many redirect addresses a client may name, so a request stores a bounded row.
  A client's name is cut to 80 characters (written out again in `CreateOAuthClient`'s check)
*/
export const MAX_OAUTH_PARAMETER_LENGTH = 2048
export const MAX_OAUTH_REDIRECT_URIS = 10
export const MAX_OAUTH_CLIENT_NAME_LENGTH = 80

/*
  A client ID metadata document: read through `fetchOutbound` with no redirect, up to 5 KB within
  five seconds, and kept for an hour, a failure for a minute, at most 500 at once in an instance's
  memory
*/
export const MAX_CLIENT_METADATA_DOCUMENT_BYTES = 5 * 1024
export const CLIENT_METADATA_DOCUMENT_TIMEOUT_MS = 5000
export const CLIENT_METADATA_DOCUMENT_LIFETIME_MS = 60 * 60 * 1000
export const CLIENT_METADATA_DOCUMENT_FAILURE_LIFETIME_MS = 60 * 1000
export const MAX_CLIENT_METADATA_DOCUMENTS_KEPT = 500

/*
  What a refresh token's successors are derived under outside production, which reads
  `oauth-token-secret` from Secret Manager instead: nothing it derives opens anything but the
  emulators
*/
export const DEVELOPMENT_OAUTH_TOKEN_SECRET = 'strategydance-development-oauth-token-secret'

/* ---
  DIRECTORIES
--- */

// The repository the directories' check reads the lists from and opens its pull request in, the
// branch it commits to, which it alone writes, and the branch that pull request goes into
export const GITHUB_REPOSITORY = 'dherault/strategydance'

export const DIRECTORY_CHECK_BRANCH = 'directories-check'

export const DIRECTORY_CHECK_BASE_BRANCH = 'dev'

// How long one call to GitHub's API may take, which a run's budget counts on
export const GITHUB_REQUEST_TIMEOUT_MS = 15 * 1000

// The directories package's two lists, from the repository's root
export const DIRECTORIES_FILE_PATH = 'packages/strategydance-directories/src/directories.json'

export const INACTIVE_DIRECTORIES_FILE_PATH = 'packages/strategydance-directories/src/inactiveDirectories.json'

/* ---
  INTEGRATIONS
--- */

/*
  The Cloud KMS key an organization's MCP server's key is encrypted with, read and written only
  in production, by the runtime service account, which holds
  `roles/cloudkms.cryptoKeyEncrypterDecrypter` on it alone (setup step 9 of conversations.md)
*/
export const INTEGRATION_KMS_KEY_NAME = `projects/${FIREBASE_PROJECT_ID}/locations/us-central1/keyRings/integrations/cryptoKeys/integration-secrets`

/*
  What a server's key is encrypted with outside production, with AES-256-GCM, in base64: nothing it
  encrypts leaves the emulators
*/
export const DEVELOPMENT_INTEGRATION_KEY = 'R8LcZ+EtejprT21lOlRLjP9PXko8NVzfUbxDoCt8FRU='

/*
  Reaching a server, to list its tools or discover its authorization server: each request within 15
  seconds and 4 MiB, the whole of it within 30 seconds, as M29 holds each call to
*/
export const INTEGRATION_REQUEST_TIMEOUT_MS = 15_000
export const INTEGRATION_OPERATION_TIMEOUT_MS = 30_000
export const MAX_INTEGRATION_RESPONSE_BYTES = 4 * 1024 * 1024

/*
  How long a call's arguments may be, as JSON, in characters: a call past it is refused before it is
  drawn, so no approval shows arguments the member could not read whole
*/
export const MAX_INTEGRATION_CALL_ARGUMENTS_LENGTH = 100_000

// How much of a call's arguments its approval shows at a glance, in characters
export const MAX_INTEGRATION_ARGUMENTS_PREVIEW_LENGTH = 2000

/*
  Strategy Dance as an OAuth client of an organization's MCP servers, which members connect their own
  accounts to: where an authorization server sends the browser back, the address of Strategy Dance's
  client ID metadata document, which is its `client_id` wherever a server reads such documents, and
  the app's page a sign-in ends on. Off the backend's own address, as the issuer's are, so a
  worktree's backend on another port names its own. An authorization server fetches the document
  itself, so it is offered only at an https address, and development registers instead
*/
export const INTEGRATION_OAUTH_CALLBACK_URL = `${OAUTH_ISSUER}/integrations/oauth/callback`
export const INTEGRATION_OAUTH_CLIENT_ID = `${OAUTH_ISSUER}/integrations/oauth/client`
export const INTEGRATION_CONNECTED_URL = `${APP_URL}${INTEGRATION_CONNECTED_PATH}`
export const IS_INTEGRATION_CLIENT_METADATA_DOCUMENT_SERVED = INTEGRATION_OAUTH_CLIENT_ID.startsWith('https://')

/*
  How long a member's Connect waits for its sign-in, and the code that sign-in brings back for the
  member's page to finish it. Written out again in `StartIntegrationAuthorization` and
  `ReceiveIntegrationAuthorizationCode`, which cannot import them: change them together
*/
export const INTEGRATION_AUTHORIZATION_LIFETIME_MS = 10 * 60 * 1000
export const INTEGRATION_AUTHORIZATION_CODE_LIFETIME_MS = 2 * 60 * 1000

/*
  Refreshing a member's tokens: an access token is refreshed a minute before it expires; the refresh
  takes a lease of two minutes, which outlasts its 30 seconds of requests and the encryption around
  them, so a refresh that is still going never loses it (written out again in
  `ClaimIntegrationConnectionRefresh`); and a caller who finds another refresh under way reads the
  connection again every half second, for twenty seconds at most, rather than spend the refresh token
  twice
*/
export const INTEGRATION_REFRESH_MARGIN_MS = 60 * 1000
export const INTEGRATION_REFRESH_LEASE_MS = 2 * 60 * 1000
export const INTEGRATION_REFRESH_WAIT_MS = 20 * 1000
export const INTEGRATION_REFRESH_POLL_MS = 500

// How long revoking a member's tokens at their authorization server may take, which a disconnect
// tries and never waits on for longer
export const INTEGRATION_REVOCATION_TIMEOUT_MS = 5000

/*
  How long a code or a token an authorization server gives may be, past which it is refused rather
  than stored: far past any real one, so a response that is something else is not kept
*/
export const MAX_INTEGRATION_TOKEN_LENGTH = 16 * 1024

/* ---
  SECRETS

  Names in Secret Manager, in the `strategydance` project, read through `retrieveSecret`
--- */

// Read only in production, which is the only environment that sends email
export const SECRET_RESEND_API_KEY = 'resend-api-key'

// Claude's API key, for the conversations agent. A machine whose credentials cannot read it sets
// ANTHROPIC_API_KEY instead
export const SECRET_ANTHROPIC_API_KEY = 'anthropic-api-key'

// What a rotated refresh token's successors are derived under, read by version, so a duplicate
// derives under the version its first use recorded. Read only in production
export const SECRET_OAUTH_TOKEN_SECRET = 'oauth-token-secret'

// The GitHub App the directories' check opens its pull request as: its id and its private key, in
// PEM. Read only by the worker, and by `check:directories --publish`
export const SECRET_GITHUB_APP_ID = 'github-app-id'

export const SECRET_GITHUB_APP_PRIVATE_KEY = 'github-app-private-key'

/* ---
  EMAIL
--- */

/*
  Where every email comes from. Its domain has to stay verified in Resend, DKIM and SPF, or every
  send is refused, and the mailbox has to receive: the welcome email asks for a reply
*/
export const EMAIL_SENDER_ADDRESS = 'david@strategydance.com'
