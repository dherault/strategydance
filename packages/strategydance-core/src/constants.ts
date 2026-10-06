import { Locale } from './enums'
import type { OrganizationImageKind } from './types'

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

// A file that is not one of the pictures a route accepts, whatever its request called it
export const ERROR_CODE_UNSUPPORTED_MEDIA_TYPE = 'UNSUPPORTED_MEDIA_TYPE' // 415

export const ERROR_CODE_TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS' // 429

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
  How many task lists one person keeps in an organization, how many tasks a list holds, and how
  long a list's name and a task may be. Written out again in `CreateTaskList`'s, `RenameTaskList`'s,
  `CreateTask`'s and `UpdateTask`'s checks and in `GetTaskLists`' and `GetTasks`' limits, which
  cannot import them: change them together
*/
export const MAX_TASK_LISTS = 100
export const MAX_TASKS_PER_LIST = 1000
export const MAX_TASK_LIST_NAME_LENGTH = 120
export const MAX_TASK_LENGTH = 120

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
  Conversations are open to Strategy Dance's own administrators (`User.isAdministrator`) alone
  while they are built, and everything that offers one or runs one asks this first. It hides an
  unfinished feature and protects no data: a conversation is its author's alone either way
*/
export const ARE_CONVERSATIONS_STAFF_ONLY: boolean = true

/*
  How many conversations a member keeps in an organization, and how many of their runs may go at
  once there. A deleted conversation does not count, so taking a delete back is held to the first
  as starting one is. The second bounds concurrency rather than usage: a run waiting for an answer
  has ended, and holds no place
*/
export const MAX_CONVERSATIONS = 1000
export const MAX_ACTIVE_RUNS_PER_MEMBER = 3

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
  How far a search in a language written without spaces, Chinese or Japanese, reads. No index
  serves a match inside a sentence, so it reads the messages of the most recently active
  conversations, and the text of the most recently updated documents, up to these many
*/
export const MAX_SUBSTRING_SEARCH_MESSAGES = 20000
export const MAX_SUBSTRING_SEARCH_DOCUMENTS = 100
