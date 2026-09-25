import { Locale } from './enums'

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

export const PRODUCTION_APP_HOSTNAME = 'sunshineteams.com'

export const PRODUCTION_APP_URL = `https://${PRODUCTION_APP_HOSTNAME}`

/* API */

// 3003 in development, and nothing reads this in production, where Cloud Run sets `PORT`
export const DEVELOPMENT_API_PORT = 3003

export const DEVELOPMENT_API_URL = `http://localhost:${DEVELOPMENT_API_PORT}`

/*
  Cloud Run's deterministic URL for the `strategydance-backend` service: its name, the project
  number and the region. Known before the first deploy, so no build has to wait on one. A custom
  domain mapped onto the service later replaces it here
*/
export const PRODUCTION_API_URL = 'https://strategydance-backend-995028545701.us-central1.run.app'

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

// What somebody does in an organization, as the team page shows it beside their name
export const MAX_JOB_TITLE_LENGTH = 60
