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

// A file that is not one of the pictures a route accepts, whatever its request called it
export const ERROR_CODE_UNSUPPORTED_MEDIA_TYPE = 'UNSUPPORTED_MEDIA_TYPE' // 415

export const ERROR_CODE_TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS' // 429

export const ERROR_CODE_INTERNAL_ERROR = 'INTERNAL_ERROR' // 500

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
  How long a member's top priority may be, the one line their team reads on its Today page.
  Written out again in `UpdateTopPriority`'s check, which cannot import it: change the two together
*/
export const MAX_TOP_PRIORITY_LENGTH = 140

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
  How long a log entry's serialized editor state may be, which is about a page of formatted text.
  Written out again in `CreateLogEntry`'s and `UpdateLogEntry`'s checks, which cannot import it:
  change the three together
*/
export const MAX_LOG_ENTRY_LENGTH = 50000
