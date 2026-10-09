import {
  ARE_CONVERSATIONS_STAFF_ONLY,
  DEVELOPMENT_API_PORT,
  DEVELOPMENT_APP_URL,
  PRODUCTION_APP_URL,
} from 'strategydance-core'

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
  Whether conversations are open to Strategy Dance's administrators alone in this process: while
  they are built (`ARE_CONVERSATIONS_STAFF_ONLY`), everywhere but the development backend, where
  every member of every organization has them, so the whole feature can be tried locally without
  granting anybody anything. Cloud Run and the tests keep the gate
*/
export const IS_CONVERSATIONS_RELEASE_GATED = ARE_CONVERSATIONS_STAFF_ONLY && !IS_DEVELOPMENT

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
  gives every site, and the preview channel each pull request deploys, which is a production build
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

// How often a worker reads whether its run's member asked to stop it while a request streams. It
// reads it before each request too
export const CONVERSATION_RUN_STOP_CHECK_INTERVAL_MS = 2000

/*
  How long one of Strategy Dance's own tools may take on a call, and how many calls that only read
  run at once, side by side: a call past its time fails, and whatever it answers later is dropped.
  A call that writes runs alone, so writes land in the order Claude made them
*/
export const CONVERSATION_TOOL_CALL_TIMEOUT_MS = 60 * 1000
export const CONVERSATION_READ_CALLS_AT_ONCE = 4

/*
  How long after a run was queued a route that finds its task gone queues it again, rather than
  finalizing the run as interrupted: as long as a queued run's first lease. A task that could not be
  queued, or was lost, is queued again while the member still waits on its page, which asks every
  two minutes, and a run whose task keeps going missing ends once it is older
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

/* ---
  SECRETS

  Names in Secret Manager, in the `strategydance` project, read through `retrieveSecret`
--- */

// Read only in production, which is the only environment that sends email
export const SECRET_RESEND_API_KEY = 'resend-api-key'

// Claude's API key, for the conversations agent. A machine whose credentials cannot read it sets
// ANTHROPIC_API_KEY instead
export const SECRET_ANTHROPIC_API_KEY = 'anthropic-api-key'

/* ---
  EMAIL
--- */

/*
  Where every email comes from. Its domain has to stay verified in Resend, DKIM and SPF, or every
  send is refused, and the mailbox has to receive: the welcome email asks for a reply
*/
export const EMAIL_SENDER_ADDRESS = 'david@strategydance.com'
