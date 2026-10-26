import { type Currency, Locale } from './enums'
import type { BudgetPeriod, ModuleDefinition, ModuleName, OrganizationImageKind } from './types'

/*
  Bound through a local rather than exported straight off the call.

  A capitalised export whose value is a call expression reads as a component behind a HOC to the
  dev server's Fast Refresh pass, which registers it and emits a bare `$RefreshReg$` at the end of
  the module. A page holds that global, installed by the refresh preamble; anything else
  evaluating the module does not, and throws. So the rule is the whole of the rule: no
  `export const CAPITALISED = someCall()` anywhere in this package
*/
const supportedLocales = Object.values(Locale)

export const SUPPORTED_LOCALES = supportedLocales

// The source locale. It has no catalogue of its own: its strings are the `defaultMessage`s the
// frontend bundle already carries
export const DEFAULT_LOCALE = Locale.EN

/* ---
  URLS
--- */

/* Environment */

export const DEVELOPMENT_APP_PORT = 5173

export const DEVELOPMENT_APP_URL = `http://localhost:${DEVELOPMENT_APP_PORT}`

export const PRODUCTION_APP_HOSTNAME = 'strategydance.com'

export const PRODUCTION_APP_URL = `https://${PRODUCTION_APP_HOSTNAME}`

/* API */

// 3003 in development, and nothing reads this in production, where Cloud Run sets `PORT`
export const DEVELOPMENT_API_PORT = 3003

export const DEVELOPMENT_API_URL = `http://localhost:${DEVELOPMENT_API_PORT}`

/*
  A Cloud Run domain mapping onto the `strategydance-backend` service, under the app's own
  hostname. The service still answers on its `run.app` URL, but this one outlives a move to
  another region or project, which changes that URL
*/
export const PRODUCTION_API_URL = `https://api.${PRODUCTION_APP_HOSTNAME}`

// Where the web app puts its App Check token on a call to the backend
export const HEADER_APP_CHECK_TOKEN = 'X-Firebase-AppCheck'

/* ---
  API ERROR CODES
--- */

/*
  What an error response's `code` says, beside its status. The status is what a client branches
  on first; a code separates the causes that share one, like a missing token and a failed App
  Check, which are both 401
*/

export const ERROR_CODE_BAD_REQUEST = 'BAD_REQUEST' // 400

export const ERROR_CODE_UNAUTHORIZED_AUTHENTICATION = 'UNAUTHORIZED_AUTHENTICATION' // 401

export const ERROR_CODE_UNAUTHORIZED_APP_CHECK = 'UNAUTHORIZED_APP_CHECK' // 401

export const ERROR_CODE_FORBIDDEN = 'FORBIDDEN' // 403

/*
  A 403 for a member whose ID token says their address is not confirmed yet, who starts or
  continues no run until it is: an account costs nothing to make, and a password sign-up can name
  any address nobody has claimed, so the daily caps' allowance is an address its owner confirmed.
  Confirming it, then minting a new token, is the reader's way on
*/
export const ERROR_CODE_EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED' // 403

// A 403 for an account, or a member of an organization, whose conversations Strategy Dance's staff
// suspended: nothing the reader does lifts it, only writing to Strategy Dance
export const ERROR_CODE_CONVERSATIONS_SUSPENDED = 'CONVERSATIONS_SUSPENDED' // 403

export const ERROR_CODE_NOT_FOUND = 'NOT_FOUND' // 404

export const ERROR_CODE_CONFLICT = 'CONFLICT' // 409

// A 409 as well, set apart because the reader can do something about it that a conflict does not
// ask of them: make room
export const ERROR_CODE_TEAM_FULL = 'TEAM_FULL' // 409

// A 409 for a conversation that already has a run going, or a member who already has as many in
// flight as they may: the action is fine, only its moment is not, so the reader tries again
export const ERROR_CODE_CONVERSATION_BUSY = 'CONVERSATION_BUSY' // 409

// A 409 set apart as `TEAM_FULL` is: a conversation that holds as much as it can takes no more
// messages, and the reader's way on is a new conversation
export const ERROR_CODE_CONVERSATION_FULL = 'CONVERSATION_FULL' // 409

// A 409 for a member who keeps as many conversations in an organization as they may
// (`MAX_CONVERSATIONS`): starting another takes deleting one first
export const ERROR_CODE_TOO_MANY_CONVERSATIONS = 'TOO_MANY_CONVERSATIONS' // 409

/*
  A 409 for a version of a document that cannot be written back as the document stands: longer
  than a document may be once restored, or the text holding what this release's editor cannot
  read, a newer one's block say. Another version may go back, and this one never will, where a
  conflict, somebody writing since an Undo was offered, asks the reader to look again
*/
export const ERROR_CODE_DOCUMENT_REVISION_UNRESTORABLE = 'DOCUMENT_REVISION_UNRESTORABLE' // 409

/*
  A 400 set apart for the consent page: the app asking for access could not be verified, its client
  ID metadata document unreachable, malformed or not naming the address it is sent back to, so the
  member can do nothing with the request but leave it
*/
export const ERROR_CODE_OAUTH_CLIENT_REFUSED = 'OAUTH_CLIENT_REFUSED' // 400

// A 409 for a member who connected as many external agents as they may (`MAX_AGENT_CONNECTIONS`):
// allowing another takes disconnecting one first
export const ERROR_CODE_TOO_MANY_AGENT_CONNECTIONS = 'TOO_MANY_AGENT_CONNECTIONS' // 409

// A 409 for a member who has as many files uploaded and not sent yet in an organization as they may
// (`MAX_PENDING_CONVERSATION_ATTACHMENTS`): sending or removing one makes room
export const ERROR_CODE_TOO_MANY_PENDING_ATTACHMENTS = 'TOO_MANY_PENDING_ATTACHMENTS' // 409

/*
  A 409 for a message whose files the conversation has no room for: past its files, its images, its
  bytes or its PDF pages, or past what its next request to Claude may take. The conversation still
  takes text, and a new one takes the files
*/
export const ERROR_CODE_CONVERSATION_ATTACHMENTS_OVER_BUDGET = 'CONVERSATION_ATTACHMENTS_OVER_BUDGET' // 409

// A file past what Claude or the route takes: its bytes, an image's size or sides, a PDF's pages or
// a text file's characters
export const ERROR_CODE_ATTACHMENT_TOO_LARGE = 'ATTACHMENT_TOO_LARGE' // 413

// A file that is not one of the types a route accepts, whatever its request called it, or one that
// Claude cannot read
export const ERROR_CODE_UNSUPPORTED_MEDIA_TYPE = 'UNSUPPORTED_MEDIA_TYPE' // 415

// A 409 for an organization that has as many MCP servers as it may (`MAX_INTEGRATIONS`): adding or
// restoring another takes deleting one first
export const ERROR_CODE_TOO_MANY_INTEGRATIONS = 'TOO_MANY_INTEGRATIONS' // 409

// A 409 for a server named as another of the organization's is, whatever the case: the agent names
// a server by its name, so two would be one
export const ERROR_CODE_INTEGRATION_NAME_TAKEN = 'INTEGRATION_NAME_TAKEN' // 409

/*
  Why a server could not be added, changed or reached again, each a 422 an administrator acts on
  in its own way: the address is not one Strategy Dance reaches (not https, or not on the public
  internet), nothing answered there, it answered too late, it refused the key, it asked for
  authentication the server was added without, it did not answer as an MCP server, its OAuth
  discovery failed or names no way for Strategy Dance to connect, or it lists more tools than a
  server may. Each is one of the database's `IntegrationError` values with `INTEGRATION_` before
  it, which `INTEGRATION_FAILURE_ERROR_CODES` pairs
*/
export const ERROR_CODE_INTEGRATION_ADDRESS_REFUSED = 'INTEGRATION_ADDRESS_REFUSED' // 422
export const ERROR_CODE_INTEGRATION_UNREACHABLE = 'INTEGRATION_UNREACHABLE' // 422
export const ERROR_CODE_INTEGRATION_TIMED_OUT = 'INTEGRATION_TIMED_OUT' // 422
export const ERROR_CODE_INTEGRATION_KEY_REFUSED = 'INTEGRATION_KEY_REFUSED' // 422
export const ERROR_CODE_INTEGRATION_AUTHENTICATION_REQUIRED = 'INTEGRATION_AUTHENTICATION_REQUIRED' // 422
export const ERROR_CODE_INTEGRATION_NOT_MCP_SERVER = 'INTEGRATION_NOT_MCP_SERVER' // 422
export const ERROR_CODE_INTEGRATION_DISCOVERY_FAILED = 'INTEGRATION_DISCOVERY_FAILED' // 422
export const ERROR_CODE_INTEGRATION_TOO_MANY_TOOLS = 'INTEGRATION_TOO_MANY_TOOLS' // 422

/*
  Each of the database's `IntegrationError` values and the code a route answers it with, written
  out since this package cannot import the generated enum: the backend types its use of this over
  the enum, so a value added there fails its typecheck until it is paired here
*/
export const INTEGRATION_FAILURE_ERROR_CODES = {
  ADDRESS_REFUSED: ERROR_CODE_INTEGRATION_ADDRESS_REFUSED,
  UNREACHABLE: ERROR_CODE_INTEGRATION_UNREACHABLE,
  TIMED_OUT: ERROR_CODE_INTEGRATION_TIMED_OUT,
  KEY_REFUSED: ERROR_CODE_INTEGRATION_KEY_REFUSED,
  AUTHENTICATION_REQUIRED: ERROR_CODE_INTEGRATION_AUTHENTICATION_REQUIRED,
  NOT_MCP_SERVER: ERROR_CODE_INTEGRATION_NOT_MCP_SERVER,
  DISCOVERY_FAILED: ERROR_CODE_INTEGRATION_DISCOVERY_FAILED,
  TOO_MANY_TOOLS: ERROR_CODE_INTEGRATION_TOO_MANY_TOOLS,
} as const

/*
  Why a member could not connect their account to an OAuth server, beside the failures above: its
  discovery named another authorization server than the one recorded, which only an administrator's
  Retry takes (409); the sign-in it came back from expired or was finished already (410); it was
  started by another account, as a link somebody else started and sent would be (403); or the
  authorization server refused the code or answered no token Strategy Dance can use (422). An
  administrator's Retry answers the last-but-one's sibling, a connection of theirs the server no
  longer takes, which connecting again mends (409)
*/
export const ERROR_CODE_INTEGRATION_ISSUER_CHANGED = 'INTEGRATION_ISSUER_CHANGED' // 409
export const ERROR_CODE_INTEGRATION_AUTHORIZATION_EXPIRED = 'INTEGRATION_AUTHORIZATION_EXPIRED' // 410
export const ERROR_CODE_INTEGRATION_AUTHORIZATION_NOT_YOURS = 'INTEGRATION_AUTHORIZATION_NOT_YOURS' // 403
export const ERROR_CODE_INTEGRATION_CONNECTION_REFUSED = 'INTEGRATION_CONNECTION_REFUSED' // 422
export const ERROR_CODE_INTEGRATION_CONNECTION_EXPIRED = 'INTEGRATION_CONNECTION_EXPIRED' // 409

export const ERROR_CODE_TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS' // 429

/*
  A 429 for each daily cap a start of conversations reaches, set apart so the reader is told which
  and whose: the member's in this organization, the account's across its organizations, or the
  organization's. Answered with a `Retry-After`, the seconds until the cap has room again
*/
export const ERROR_CODE_MEMBER_DAILY_CONVERSATIONS_REACHED = 'MEMBER_DAILY_CONVERSATIONS_REACHED' // 429
export const ERROR_CODE_ACCOUNT_DAILY_CONVERSATIONS_REACHED = 'ACCOUNT_DAILY_CONVERSATIONS_REACHED' // 429
export const ERROR_CODE_ORGANIZATION_DAILY_CONVERSATIONS_REACHED = 'ORGANIZATION_DAILY_CONVERSATIONS_REACHED' // 429
export const ERROR_CODE_MEMBER_DAILY_RUNS_REACHED = 'MEMBER_DAILY_RUNS_REACHED' // 429
export const ERROR_CODE_ACCOUNT_DAILY_RUNS_REACHED = 'ACCOUNT_DAILY_RUNS_REACHED' // 429
export const ERROR_CODE_ORGANIZATION_DAILY_RUNS_REACHED = 'ORGANIZATION_DAILY_RUNS_REACHED' // 429

/*
  A 429 for each daily spend ceiling a start reaches, the member's in this organization, the
  account's across its organizations, or the organization's, answered with a `Retry-After` as the
  caps' are
*/
export const ERROR_CODE_MEMBER_DAILY_SPEND_REACHED = 'MEMBER_DAILY_SPEND_REACHED' // 429
export const ERROR_CODE_ACCOUNT_DAILY_SPEND_REACHED = 'ACCOUNT_DAILY_SPEND_REACHED' // 429
export const ERROR_CODE_ORGANIZATION_DAILY_SPEND_REACHED = 'ORGANIZATION_DAILY_SPEND_REACHED' // 429

export const ERROR_CODE_INTERNAL_ERROR = 'INTERNAL_ERROR' // 500

// The server cannot take the request now, and the same request later can succeed, so the reader
// tries again: a conversation's run, until runs go through the queue in production
export const ERROR_CODE_SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE' // 503

// Never sent by the backend: what a client reports when the answer was not an envelope at all
export const ERROR_CODE_UNKNOWN_ERROR = 'UNKNOWN_ERROR'

/* ---
  ORGANIZATIONS
--- */

// How many addresses one invite request may carry. The invite field and the endpoint both hold
// to it, so a paste the endpoint would refuse is refused before it is sent
export const MAX_INVITATIONS_PER_REQUEST = 50

/*
  How many members and pending invitations one organization holds, together. The database
  enforces it on every invitation, and the team query reads exactly this many of each, so the
  page never shows a team cut short. Written out again in `CreateOrganizationInvitation`'s check
  and `GetOrganizationTeam`'s limits, which cannot import it: change the three together
*/
export const MAX_TEAM_SIZE = 100

// What somebody does in an organization, as the team page shows it beside their name
export const MAX_JOB_TITLE_LENGTH = 60

/*
  How long an organization's name may be. Written out again in `CreateOrganization`'s and
  `UpdateOrganization`'s checks, which cannot import it: change the three together
*/
export const MAX_ORGANIZATION_NAME_LENGTH = 80

/*
  How long an organization's brief may be, which its team, the community and agents read. Written
  out again in `CreateOrganization`'s and `UpdateOrganization`'s checks, which cannot import it:
  change the three together
*/
export const MAX_ORGANIZATION_BRIEF_LENGTH = 500

/*
  An organization's slug, the segment that leads each of its pages' paths: its name made into
  words of lowercase letters and digits joined by dashes, at most this long, then a dash and a few
  random characters, as in `strategy-dance-ad34`
*/
export const ORGANIZATION_SLUG_BASE_MAX_LENGTH = 32

export const ORGANIZATION_SLUG_SUFFIX_LENGTH = 4

/*
  What a slug looks like. It always ends in a dash and four characters, so no slug can be one of
  the app's own pages at the root, like `legal` or `today`, which no organization could then reach.
  Written out again in `CreateOrganization`'s check, which cannot import it: the database's
  `schema.test.ts` fails when the two differ
*/
export const ORGANIZATION_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*-[a-z0-9]{4}$/

/*
  The color an organization's mark takes until somebody picks one: the brand's primary, the design
  system's `--color-primary-700`. A null `Organization.color` means this one, so an organization
  that never chose follows the brand if it changes
*/
export const DEFAULT_ORGANIZATION_COLOR = '#0051A3'

// The pictures an organization can carry, each stored under `organizations/{id}/{kind}/`
export const ORGANIZATION_IMAGE_KINDS: OrganizationImageKind[] = ['logo', 'banner']

/*
  Raster only, and deliberately not `image/*`: that admits `image/svg+xml`, which is an active
  document rather than a picture. The backend reads the type off the file's first bytes rather
  than off the request, so a script named `logo.png` is refused too
*/
export const ORGANIZATION_IMAGE_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

// In bytes. The profile page refuses a larger file before sending it, and the backend refuses it
// again before reading it
export const MAX_ORGANIZATION_IMAGE_SIZES: Record<OrganizationImageKind, number> = {
  logo: 2 * 1024 * 1024,
  banner: 5 * 1024 * 1024,
}

/*
  The square a thumbnail fits inside, in pixels. The page draws one as it uploads a logo or a
  profile picture, and uploads it beside the picture, for where the picture is drawn small: the
  organization switcher, the user menu
*/
export const THUMBNAIL_SIZE = 256

/*
  In bytes. A thumbnail's pixels, uncompressed, take a quarter of a megabyte, so this holds any
  thumbnail and refuses a full picture sent as one. The backend refuses a larger one, and so does
  `storage.rules`, which cannot read it from here and writes it out again
*/
export const MAX_THUMBNAIL_SIZE = 512 * 1024

/* ---
  USERS
--- */

/*
  How long a new account keeps being offered its welcome email, in days. The web app asks for it on
  each visit until it has gone out, so a request lost to a closed tab or a backend that was down is
  made again; past this, an account predates the email or its welcome has failed for a week, and a
  late one would read oddly. Written out again in `ClaimWelcomeEmail`, which cannot import it:
  change the two together
*/
export const WELCOME_EMAIL_WINDOW_DAYS = 7

/*
  How long somebody's name may be, as the account page saves it. Written out again in
  `UpdateCurrentUserProfile`'s check, which cannot import it: change the two together. A name that
  arrives from Google instead is mirrored as it is, and kept so until somebody changes it
*/
export const MAX_USER_NAME_LENGTH = 80

/*
  How long somebody's bio may be, which their team and agents read. Written out again in
  `UpdateCurrentUserProfile`'s check, which cannot import it: change the two together
*/
export const MAX_USER_BIO_LENGTH = 200

/* ---
  TODAY
--- */

/*
  How long a member's top priority may be, the BlockNote blocks their team reads on its Today page,
  serialized: room to spare for 500 characters whose styles change at nearly every one, since each
  run of text costs about fifty characters of its own. Written out again in `UpdateTopPriority`'s
  check, which cannot import it: change the two together
*/
export const MAX_TOP_PRIORITY_LENGTH = 100000

/*
  How many characters the words of a top priority may run to, which the dialog counts and holds it
  to. The server cannot count them in serialized blocks, and holds it to the length above instead
*/
export const MAX_TOP_PRIORITY_TEXT_LENGTH = 500

/*
  How many live columns one person's checklist holds in an organization, and how long a column's
  name may be, short enough to read slanted above it. Written out again in the checklist
  mutations' checks and in `GetChecklist`'s limit, which cannot import them: change them together
*/
export const MAX_CHECKLIST_ITEMS = 100
export const MAX_CHECKLIST_ITEM_NAME_LENGTH = 40

/*
  How many days an unfolded checklist draws at most, today included, and how many ticks a column
  reads back for it: ten years. A tick cannot be for a day before its owner joined, so only a
  member of that long reaches it. Written out again in `GetChecklistHistory`'s limit, which cannot
  import it: change the two together
*/
export const MAX_CHECKLIST_HISTORY_DAYS = 3660

/*
  How long a log entry's serialized blocks may be, which is about a page of formatted text.
  Written out again in `CreateLogEntry`'s and `UpdateLogEntry`'s checks, which cannot import it:
  change the three together
*/
export const MAX_LOG_ENTRY_LENGTH = 50000

/* ---
  TASKS
--- */

/*
  How many live tasks an organization keeps on its board, how long a task's name may be, on one
  line, how long its description's serialized blocks may run, and how many tasks one may wait on.
  The board reads every description at once, for its search, so they are held to a short brief
  rather than a document. Written out again in the task mutations' checks and in `GetTasks`' and
  `GetTaskDescriptions`' limits, which cannot import them: change them together
*/
export const MAX_TASKS = 1000
export const MAX_TASK_NAME_LENGTH = 120
export const MAX_TASK_DESCRIPTION_LENGTH = 20000
export const MAX_TASK_DEPENDENCIES = 50

/* ---
  KNOWLEDGE
--- */

/*
  How many documents an organization keeps in its knowledge, how long a document's title may be,
  on one line, and how long its serialized blocks may run, which is room for a long plan in
  formatted text. Written out again in `CreateDocument`'s, `RestoreDocument`'s, `RenameDocument`'s
  and `UpdateDocumentContent`'s checks and in `GetOrganizationDocuments`' limit, which cannot import
  them: change them together
*/
export const MAX_DOCUMENTS = 1000
export const MAX_DOCUMENT_TITLE_LENGTH = 200
export const MAX_DOCUMENT_CONTENT_LENGTH = 200000

/*
  A document's text is a Yjs document, stored as a snapshot in base64 with the updates made since
  it pending beside it. Yjs encodes text as UTF-8, three bytes a character in Chinese or Japanese,
  so the 200000 characters of content can come to 600000 bytes, 800000 characters of base64, before
  Yjs' own structure, and a snapshot also keeps what was deleted as small tombstones: it is held to
  well past that worst case.

  An update is small, as the live query sends every pending one to every open tab at each push: at
  most 50000 characters, and at most 100 pending, so a push sends a few megabytes at the very most
  and a few kilobytes as a rule. An edit too long to push, a long paste say, is folded into the
  snapshot instead. Once 50 are pending the tab whose push brought them there folds them, and a
  tab that finds as many as a read takes folds them at once.

  Written out again in `CreateDocument`'s, `SeedDocumentState`'s, `PushDocumentUpdate`'s and
  `CompactDocument`'s checks and in `GetDocument`'s and `GetLiveDocument`'s limits: change them
  together
*/
export const MAX_DOCUMENT_STATE_LENGTH = 2000000
export const MAX_DOCUMENT_UPDATE_LENGTH = 50000
export const DOCUMENT_COMPACTION_THRESHOLD = 50
export const DOCUMENT_UPDATES_LIMIT = 100

/*
  How long the text a document held before an agent's edit is kept, for a member to go back to:
  a month, after which the daily sweep prunes it. Written out again in
  `DeleteExpiredDocumentRevisions`: change them together
*/
export const DOCUMENT_REVISION_LIFETIME_DAYS = 30

/*
  The pictures a document's text shows, uploaded through the backend into the organization's part
  of the bucket: the raster types an organization's own pictures take, for the same reason, and up
  to 10 megabytes, a phone's photo. The editor refuses a larger file before sending it, and the
  backend refuses it again before reading it
*/
export const RICH_TEXT_IMAGE_CONTENT_TYPES = ORGANIZATION_IMAGE_CONTENT_TYPES
export const MAX_RICH_TEXT_IMAGE_SIZE = 10 * 1024 * 1024

/* ---
  CONVERSATIONS
--- */

/*
  How many conversations a member keeps in an organization, and how many of their runs may go at
  once there. A deleted conversation does not count, so taking a delete back is held to the first
  as starting one is. The second bounds concurrency rather than usage: a run waiting for an answer
  has ended, and holds no place
*/
export const MAX_CONVERSATIONS = 1000
export const MAX_ACTIVE_RUNS_PER_MEMBER = 3

/*
  How many conversations, runs and subagents may start in 24 hours, counted over the 24 hours before
  each start rather than a calendar day: per member in each organization, per account across every
  organization it is in, since an account makes organizations at will, and per organization. They
  guard spend until a credit system replaces them, staff's included. Starting a conversation, a send,
  Resume, Retry and a launch are refused at a cap; what finishes work under way, an answer's
  continuation, an Allow's and a reaction to subagents' reports, passes a cap, up to
  `DAILY_CAP_OVERRUN_FACTOR` times it. A subagent's own runs count toward no run cap: the subagents
  launched bound them. Every mutation that starts one counts on `CappedStart` rows and writes these
  out: change them together
*/
export const MAX_DAILY_CONVERSATIONS_PER_MEMBER = 20
export const MAX_DAILY_CONVERSATIONS_PER_ACCOUNT = 40
export const MAX_DAILY_CONVERSATIONS_PER_ORGANIZATION = 100
export const MAX_DAILY_RUNS_PER_MEMBER = 100
export const MAX_DAILY_RUNS_PER_ACCOUNT = 200
export const MAX_DAILY_RUNS_PER_ORGANIZATION = 500
export const MAX_DAILY_SUBAGENTS_PER_MEMBER = 30
export const MAX_DAILY_SUBAGENTS_PER_ACCOUNT = 60
export const DAILY_CAP_OVERRUN_FACTOR = 1.5
export const DAILY_CAP_WINDOW_HOURS = 24

/*
  How much conversations may cost in 24 hours, in microdollars, over the caps' window and in their
  three scopes, as David set them on 2026-10-19: $25 a member in each organization, $50 an account
  across its organizations and $150 an organization, about ten times a heavy member's day. Each run
  counts at the most its ledger may have cost, a request in flight at its reservation, and every
  request a worker sends is held to them, as is every start, so what passes one is only the
  requests in flight at once. Staff's included, until the credits replace them
*/
export const MAX_DAILY_SPEND_MICRODOLLARS_PER_MEMBER = 25_000_000
export const MAX_DAILY_SPEND_MICRODOLLARS_PER_ACCOUNT = 50_000_000
export const MAX_DAILY_SPEND_MICRODOLLARS_PER_ORGANIZATION = 150_000_000

/*
  How many entries a conversation holds, which bounds what it stores and the history a reader pages
  through. Its context fills up long before, and is measured on its own before each request
*/
export const MAX_CONVERSATION_MESSAGES = 2000

/*
  How many entries one run may draw, and how many tool calls it may make, in all and in one turn.
  A run past one of them sends no further request: the turn in flight is still drawn whole, and a
  call past a bound is answered as not run
*/
export const MAX_CONVERSATION_RUN_ENTRIES = 100
export const MAX_TOOL_CALLS_PER_RUN = 50
export const MAX_TOOL_CALLS_PER_TURN = 10

/*
  How long a conversation's title may be, on one line. One built from a first message or a file's
  name is cut far shorter, so only a title somebody writes comes near it
*/
export const MAX_CONVERSATION_TITLE_LENGTH = 120

/*
  How long a message may be, the member's and each piece of a reply alike: a longer reply is drawn
  as several pieces, split between its blocks
*/
export const MAX_CONVERSATION_MESSAGE_LENGTH = 20000

/*
  How many input tokens a request to Claude may take before its conversation counts as full, short
  of the model's 1M-token context: a conversation whose next request would pass it takes no more
  messages until a retry shortens it
*/
export const MAX_CONVERSATION_INPUT_TOKENS = 800000

/*
  How many input tokens a message with files may bring its conversation's next request to, short of
  `MAX_CONVERSATION_INPUT_TOKENS`, so the files a member sends never fill the conversation by
  themselves: the send measures it from what it knows, and the run measures again exactly
*/
export const MAX_CONVERSATION_SEND_INPUT_TOKENS = 700000

/*
  How much of a conversation's last entry its preview keeps, in characters of plain text, so the
  list of a member's conversations stays small however long their replies run
*/
export const MAX_CONVERSATION_PREVIEW_LENGTH = 200

/*
  A question the agent asks: how many options it offers, how long its prompt and each option may
  be, and how long the member's own answer may be, on one line. All of it goes back into what
  Claude is sent exactly as it was written, so a value past a bound is refused rather than cut
*/
export const MAX_QUESTION_OPTIONS = 6
export const MAX_QUESTION_PROMPT_LENGTH = 1000
export const MAX_QUESTION_OPTION_LENGTH = 200
export const MAX_ANSWER_OTHER_LENGTH = 500

/*
  Files sent in a conversation, in bytes: one file, and every file a conversation holds together.
  Claude reads them by reference rather than in each request, so these bound what is stored. A
  message carries a handful at most, and a text file is held to a number of characters as well
*/
export const MAX_CONVERSATION_ATTACHMENT_SIZE = 10 * 1024 * 1024
export const MAX_CONVERSATION_ATTACHMENTS_SIZE = 15 * 1024 * 1024
export const MAX_CONVERSATION_ATTACHMENTS_PER_MESSAGE = 10
export const MAX_CONVERSATION_TEXT_ATTACHMENT_LENGTH = 200000

/*
  How many pages a PDF may have, and how many a conversation's PDFs may have together, since every
  request carries them all. Claude reads up to 600 pages a request on a model with a 1M-token
  context, so both leave a margin
*/
export const MAX_CONVERSATION_PDF_PAGES = 100
export const MAX_CONVERSATION_PDF_PAGES_TOTAL = 300

/*
  How many files a conversation holds in all, and how many of them may be images, since every
  request carries them all. Claude takes up to 600 images a request, and refuses any image over 2000
  pixels a side in a request holding more than 20, so 20 images keep every request clear of that
  rule whatever their size
*/
export const MAX_CONVERSATION_ATTACHMENTS = 100
export const MAX_CONVERSATION_IMAGES = 20

/*
  An image Claude takes: up to 8000 pixels a side, read from its header, and up to 5 megabytes, which
  stays under the 10 megabytes Claude takes once the image is encoded in base64
*/
export const MAX_CONVERSATION_IMAGE_DIMENSION = 8000
export const MAX_CONVERSATION_IMAGE_SIZE = 5 * 1024 * 1024

/*
  The files a conversation takes, which the upload reads off their first bytes rather than off the
  request: the raster images Claude reads, PDFs, and text, which Claude reads as plain text whatever
  its kind. Deliberately not `image/*`, which admits `image/svg+xml`, an active document
*/
export const CONVERSATION_ATTACHMENT_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
]

// How long a file's name may be, in characters, on one line
export const MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH = 200

/*
  How many files a member may have uploaded and not sent yet in an organization. An upload reserves
  its place before any byte is accepted, and one left unsent for two days is pruned, so an
  abandoned draft never keeps a place for good
*/
export const MAX_PENDING_CONVERSATION_ATTACHMENTS = 30

/*
  How long a search may be, in characters and in words, the conversations field and the agent's
  knowledge search alike. Every word has to match, so a longer query finds nothing a shorter one
  would miss
*/
export const MAX_SEARCH_QUERY_LENGTH = 100
export const MAX_SEARCH_TERMS = 8

/*
  How many times somebody may search their conversations in an organization in ten minutes, which
  nobody searching by hand reaches and a script does. Held twice: in each backend instance's memory,
  which turns a script away cheaply, and in the database, across instances, where
  `RecordConversationSearch` writes the same numbers out: change them together
*/
export const MAX_CONVERSATION_SEARCHES = 120
export const CONVERSATION_SEARCH_WINDOW_MINUTES = 10

/*
  How far a search in a language written without spaces, Chinese or Japanese, reads. No index
  serves a match inside a sentence, so it reads the messages of the most recently active
  conversations, and the text of the most recently updated documents, up to these many
*/
export const MAX_SUBSTRING_SEARCH_MESSAGES = 20000
export const MAX_SUBSTRING_SEARCH_DOCUMENTS = 100

/*
  How many subagents Strategy Dance's agent may launch: ten on one anchor, the member's action and
  the runs carrying it on, those a retry deleted left out, so the run a retry starts can launch its
  fan-out again; and a hundred in one conversation until they are pruned, which its
  `subagentCount` counts. `LaunchSubagent` writes both out: change them together
*/
export const MAX_SUBAGENTS_PER_ACTION = 10
export const MAX_CONVERSATION_SUBAGENTS = 100

/*
  How long a subagent's brief may be, in characters, all it knows of the conversation that launched
  it, and how long its report is kept, its last reply cut short so a batch of ten never fills the
  conversation it reports to. `LaunchSubagent` and the subagent endings write them out: change them
  together
*/
export const MAX_SUBAGENT_BRIEF_LENGTH = 20000
export const MAX_SUBAGENT_REPORT_LENGTH = 8000

/*
  How many subagent runs go at once per member in an organization, across all their conversations
  and apart from their own three runs, which a fan-out never blocks: a launch past them waits
  `PENDING` for a slot, which a promotion gives it once a run ends. And how many runs a subagent
  takes, each run at a limit before the last handing on to the next. `LaunchSubagent`,
  `LaunchPendingSubagent` and `PromoteSubagentRun` write out the five, and `ChainSubagentRun` the
  four: change them together
*/
export const MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER = 5
export const MAX_SUBAGENT_RUNS = 4

/* ---
  MODULES
--- */

/*
  Strategy Dance's capabilities served as MCP servers, one per module, which its own agent uses and
  which a member can add to an agent of their own. Each is a server of its own at its own address
  on the backend, and an OAuth resource of its own, so a member connects modules one by one.

  A module's name is what the backend's `src/modules/` and the app's `module` catalogue key on. Its
  title is the server's own, in English, for what MCP clients show; the app words a module from the
  catalogue instead. Its scopes are what a consent grants, read alone or read and write, never
  write without read
*/
export const MODULES = [
  {
    name: 'knowledge',
    path: '/mcp/knowledge',
    title: 'Strategy Dance Knowledge',
    scopes: { read: 'knowledge:read', write: 'knowledge:write' },
  },
  {
    name: 'tasks',
    path: '/mcp/tasks',
    title: 'Strategy Dance Tasks',
    scopes: { read: 'tasks:read', write: 'tasks:write' },
  },
  // Strategy Dance's own agents' alone, served to no external agent: its address is reserved until a
  // later plan serves it, and the authorization server refuses it meanwhile
  {
    name: 'subagents',
    path: '/mcp/subagents',
    title: 'Strategy Dance Subagents',
    scopes: { read: 'subagents:read', write: 'subagents:write' },
  },
] as const satisfies readonly ModuleDefinition[]

/*
  The modules the public backend serves to external agents, each at its own address under its
  `/mcp` path, behind the bearer check, with its protected resource metadata at the app's root:
  Knowledge and Tasks, in `MODULES`' order. The authorization server reads them alone, its
  resources and `scopes_supported`, and so does the consent page, so a client asking for a module
  served to nobody is refused as for an address no module has, and no consent makes a connection
  that no endpoint serves. A module added to `MODULES` later joins them by its name here, once its
  write tools are challenged and its searches counted
*/
export const SERVED_MODULE_NAMES: readonly ModuleName[] = ['knowledge', 'tasks']

export const SERVED_MODULES = MODULES.filter(module => SERVED_MODULE_NAMES.includes(module.name))

/*
  How many external agents a member connects across their organizations, a connection being one per
  client, organization and module. Allow refuses another past it, so the account page's Connected
  agents tab, which reads every one, lists each agent acting as them, and Disconnect reaches it.
  Consenting again with an agent already connected replaces its connection, and counts once
*/
export const MAX_AGENT_CONNECTIONS = 100

/* ---
  INTEGRATIONS
--- */

/*
  How many MCP servers an organization adds, deleted ones not counted, so taking a delete back is
  held to it as adding is. Written out again in `CreateOrganizationIntegration`,
  `RestoreOrganizationIntegration` and the limit of `GetOrganizationIntegrations`, which cannot
  import it: change the four together
*/
export const MAX_INTEGRATIONS = 50

// How long a server's name may be, on one line, as designed
export const MAX_INTEGRATION_NAME_LENGTH = 40

// How long a server's address may be
export const MAX_INTEGRATION_URL_LENGTH = 2000

// How long an API key may be, which no real key comes near, so a paste of the wrong thing is refused
export const MAX_INTEGRATION_API_KEY_LENGTH = 4000

// How long the name of the header a key is sent in may be
export const MAX_INTEGRATION_API_KEY_HEADER_LENGTH = 64

/*
  How many tools a server may list, and how much they may hold as JSON text, so one server never
  fills the row, the dialog or, from M29, what the agent reads of the organization's servers. A
  server past either is refused, rather than kept in part
*/
export const MAX_INTEGRATION_TOOLS = 200
export const MAX_INTEGRATION_TOOLS_BYTES = 1024 * 1024

/*
  The app's page an OAuth server's sign-in ends on, in the window Connect opened: the backend's
  callback sends the browser there with what came back (`IntegrationConnectedSearch`), the page,
  signed in as the member, finishes the connection, and says how it went to the window that opened
  it on this channel, which every tab of the app's origin hears
*/
export const INTEGRATION_CONNECTED_PATH = '/integrations/connected'

export const INTEGRATION_CONNECTION_CHANNEL = 'strategydance-integration-connections'

/*
  How many characters of an account's label a connection keeps, the email or name an OAuth server's
  ID token gave, which only the member who connected reads
*/
export const MAX_INTEGRATION_ACCOUNT_LABEL_LENGTH = 100

/* ---
  BUDGET
--- */

/*
  Each currency's exponent, ISO 4217's: how many digits its minor unit takes after the point. Money
  is a whole number of minor units, so $312.40 is 31240 and ¥1,500 is 1500. Held here rather than
  read off `Intl`, whose digits differ between runtimes and would let the page and the module
  disagree on an amount
*/
export const CURRENCIES = {
  AUD: { exponent: 2 },
  BRL: { exponent: 2 },
  CAD: { exponent: 2 },
  CHF: { exponent: 2 },
  CNY: { exponent: 2 },
  CZK: { exponent: 2 },
  DKK: { exponent: 2 },
  EUR: { exponent: 2 },
  GBP: { exponent: 2 },
  HKD: { exponent: 2 },
  HUF: { exponent: 2 },
  IDR: { exponent: 2 },
  ILS: { exponent: 2 },
  INR: { exponent: 2 },
  ISK: { exponent: 0 },
  JPY: { exponent: 0 },
  KRW: { exponent: 0 },
  MXN: { exponent: 2 },
  MYR: { exponent: 2 },
  NOK: { exponent: 2 },
  NZD: { exponent: 2 },
  PHP: { exponent: 2 },
  PLN: { exponent: 2 },
  RON: { exponent: 2 },
  SEK: { exponent: 2 },
  SGD: { exponent: 2 },
  THB: { exponent: 2 },
  TRY: { exponent: 2 },
  USD: { exponent: 2 },
  ZAR: { exponent: 2 },
} as const satisfies Record<Currency, { readonly exponent: number }>

/*
  The most minor units an amount may hold. The database stores it as an `Int64`, which the SDK
  hands over as a string, and the code reads it as a number: 10^15 keeps it an exact integer, far
  below 2^53, and is still a quadrillion yen
*/
export const MAX_MONEY_MINOR = 10 ** 15

/*
  How many live bills an organization keeps, and how long a bill's name, description and company
  may be, as the prototype held them: the page and the module read every bill at once, to compute
  the budget
*/
export const MAX_BILLS = 2000
export const MAX_BILL_NAME_LENGTH = 80
export const MAX_BILL_DESCRIPTION_LENGTH = 140
export const MAX_BILL_COMPANY_LENGTH = 60

// How many months each period of a budget spans, which is also how far apart a bill recurring on
// that period is paid
export const BUDGET_PERIOD_MONTHS = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
} as const satisfies Record<BudgetPeriod, number>

/*
  The receipts a bill keeps, which the upload reads off their first bytes rather than off the
  request: PDFs, text, and the photos a phone takes. Deliberately not `image/*`, which admits
  `image/svg+xml`, an active document, nor GIF, which no receipt comes as
*/
export const BILL_RECEIPT_CONTENT_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
]

/*
  A receipt, in bytes, a PDF's pages and a text's characters: an invoice runs to a page or two, and
  whoever reads one, the receipt reader or an agent, reads it whole in one request, so a long one is
  cut at the text's length rather than refused. Written out again in `ReserveBillReceipt`'s checks,
  which cannot import them: change them together
*/
export const MAX_BILL_RECEIPT_SIZE = 10 * 1024 * 1024
export const MAX_BILL_RECEIPT_PDF_PAGES = 20
export const MAX_BILL_RECEIPT_TEXT_LENGTH = 50000

// How long a receipt's file name may be, in characters, on one line, as a conversation's file's
export const MAX_BILL_RECEIPT_NAME_LENGTH = 200
