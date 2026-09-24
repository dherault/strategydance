/* ---
  INTL
--- */

/*
  Every message catalogue the app can load. A message type is the basename of a file in
  `~data/intl/messages`, and the name of the JSON file each locale carries for it in
  `~data/intl/messages-translated/<LOCALE>/`.

  Adding one means adding the source module, the entry here, and an `IntlMessagesRegistration` on
  whichever route needs it. The translation CLI reads the directory rather than this list, so the
  two can disagree: this one is what the frontend's types are built from
*/
export const MESSAGE_TYPES = [
  'authentication',
  'global',
  'navigation',
] as const

/* ---
  STORAGE
--- */

export const LOCAL_STORAGE_PREFIX = 'strategydance:'

/* ---
  AUTHENTICATION
--- */

export const MIN_PASSWORD_LENGTH = 8

// Firebase's own ceiling. Here so the form refuses a paste that long before the request rather
// than after it
export const MAX_PASSWORD_LENGTH = 1024

/*
  What Firebase's error codes say to a reader, as keys into `~data/intl/messages/authentication`
  rather than strings: the message has to be formatted through the catalogue, and an id alone
  cannot be, because the source locale has no catalogue and renders `defaultMessage` instead.

  A code with no entry falls back to `errorDefault`, which is the honest answer for the long
  tail of codes this app has never seen
*/
export const AUTHENTICATION_ERRORS: Record<string, string> = {
  'auth/email-already-in-use': 'errorEmailAlreadyInUse',
  'auth/invalid-email': 'errorInvalidEmail',
  'auth/weak-password': 'errorWeakPassword',
  'auth/user-disabled': 'errorUserDisabled',
  'auth/user-not-found': 'errorInvalidCredential',
  'auth/wrong-password': 'errorInvalidCredential',
  'auth/invalid-credential': 'errorInvalidCredential',
  'auth/popup-closed-by-user': 'errorPopupClosedByUser',
  'auth/credential-already-in-use': 'errorCredentialAlreadyInUse',
  'auth/too-many-requests': 'errorTooManyRequests',
  'auth/network-request-failed': 'errorNetworkRequestFailed',
}

export const DEFAULT_AUTHENTICATION_ERROR = 'errorDefault'

/* ---
  GITHUB
--- */

// The project's public repository, which the sidebar invites the reader to star
export const GITHUB_REPOSITORY = 'dherault/strategydance'
