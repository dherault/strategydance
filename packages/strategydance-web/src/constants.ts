import { CompanyAspect, TaskStatus } from 'strategydance-database/web'

import type { CardTone } from '~types'

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
  'account',
  'administration',
  'aspect',
  'authentication',
  'buildInPublic',
  'checklist',
  'conversation',
  'explore',
  'global',
  'invitation',
  'knowledge',
  'landing',
  'log',
  'navigation',
  'onboarding',
  'organizationProfile',
  'support',
  'task',
  'team',
  'today',
] as const

/* ---
  STORAGE
--- */

export const LOCAL_STORAGE_PREFIX = 'strategydance:'

// The page a signed-out reader asked for, kept while they sign in
export const REDIRECT_PATH_STORAGE_KEY = `${LOCAL_STORAGE_PREFIX}redirectPath`

/* ---
  AUTHENTICATION
--- */

// How long the page a signed-out reader asked for waits for them to sign in: long enough to reset
// a password from its email, short enough that whoever signs in on that browser later starts on Today
export const REDIRECT_PATH_LIFETIME_MS = 60 * 60 * 1000

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
  COMPANY
--- */

/*
  Every aspect of a company, in the order the sidebar and the explore page present them.

  Not the schema's order, which is the Postgres enum's: reordering its values is a breaking
  migration, so the order a reader sees is kept here instead. `constants.test.ts` fails when this
  stops listing each of the schema's aspects exactly once
*/
export const COMPANY_ASPECTS: readonly CompanyAspect[] = [
  CompanyAspect.STRATEGY,
  CompanyAspect.MARKETING,
  CompanyAspect.SALES,
  CompanyAspect.PRODUCT,
  CompanyAspect.ENGINEERING,
  CompanyAspect.DESIGN,
  CompanyAspect.PEOPLE,
  CompanyAspect.FINANCES,
  CompanyAspect.LEGAL,
]

/* ---
  TASKS
--- */

/*
  The board's columns, left to right: the statuses a task moves through. The schema's order happens
  to be the same, but reordering it is a breaking migration, so the board's is kept here, and
  `constants.test.ts` fails when this stops listing each of the schema's statuses exactly once
*/
export const TASK_STATUSES: readonly TaskStatus[] = [
  TaskStatus.BACKLOG,
  TaskStatus.TODO,
  TaskStatus.ONGOING,
  TaskStatus.DONE,
]

// The badge each status wears where a task is listed outside its column, as in another's links
export const TASK_STATUS_BADGE_VARIANTS: Record<TaskStatus, 'neutral' | 'secondary' | 'primary' | 'success'> = {
  [TaskStatus.BACKLOG]: 'neutral',
  [TaskStatus.TODO]: 'secondary',
  [TaskStatus.ONGOING]: 'primary',
  [TaskStatus.DONE]: 'success',
}

/* ---
  CONVERSATIONS
--- */

// How many of a conversation's latest messages its page keeps live, as `GetConversation` reads them
export const CONVERSATION_TAIL_LENGTH = 150

// How many older messages one history page reads, as `GetConversationMessagesBefore` reads them
export const CONVERSATION_PAGE_LENGTH = 100

// How many messages' bodies one read takes, as `GetConversationMessageBodies` reads them
export const CONVERSATION_BODIES_LENGTH = 50

/*
  How long after a run's lease has passed its page asks the backend to reconcile it, so a clock a
  little ahead of the database's does not ask too soon, and how often it asks again while the run
  stays as it is
*/
export const CONVERSATION_RUN_RECONCILE_MARGIN_MS = 2000
export const CONVERSATION_RUN_RECONCILE_INTERVAL_MS = 2 * 60 * 1000

/*
  How long a page waits before it asks the backend to carry on a run waiting on questions all
  answered, which the last answer carries on itself unless its backend stopped first or the reader
  had runs going elsewhere, so it rarely has to
*/
export const CONVERSATION_ANSWER_RECONCILE_DELAY_MS = 5000

// How long the conversations' search field waits after the last keystroke before it searches, so
// a word typed is one search rather than one a letter
export const CONVERSATION_SEARCH_DELAY_MS = 300

/* ---
  BUILD IN PUBLIC
--- */

// What a build in public card can be drawn on, in the order its picker lists them
export const CARD_TONES: readonly CardTone[] = ['accent', 'tint', 'white', 'neutral', 'dark']

/*
  The colors a build in public card's accent can take besides the organization's own, in the order
  its picker lists them. Each is named by a message of its own in the `buildInPublic` catalogue
*/
export const CARD_ACCENT_COLORS = {
  blue: '#0051A3',
  sky: '#0284C7',
  navy: '#142A41',
  indigo: '#4F46E5',
  violet: '#7C3AED',
  fuchsia: '#C026D3',
  pink: '#DB2777',
  red: '#DC2626',
  orange: '#EA580C',
  amber: '#D97706',
  lime: '#65A30D',
  green: '#16A34A',
  teal: '#0D9488',
  graphite: '#404040',
  black: '#0A0A0A',
} as const

/*
  The most streak charges a member holds at once. Each day they are active earns one, and a day
  they are not uses one rather than breaking their streak: see `getStreakCharges`
*/
export const MAX_STREAK_CHARGES = 2

/* ---
  GITHUB
--- */

// The project's public repository, which the sidebar invites the reader to star
export const GITHUB_REPOSITORY = 'dherault/strategydance'

/* ---
  SUPPORT
--- */

/*
  Who the support page puts the reader in touch with, and every way it offers. The pictures are
  under `public/`, served from the site root. WhatsApp is a QR code rather than a link, so the
  number is in no page source
*/
export const SUPPORT_CONTACT = {
  name: 'David Hérault',
  pictureUrl: '/assets/images/team/david-herault-profile-picture.jpg',
  email: 'david@strategydance.com',
  calendarUrl: 'https://calendar.app.google/sPzxWTDKVUvG7koF9',
  xUrl: 'https://x.com/dherault111',
  whatsAppQrCodeUrl: '/assets/images/team/david-herault-whatsapp-qrcode.png',
}

/* ---
  USERS
--- */

/*
  What the account page takes as a profile picture: raster only, as `storage.rules` accepts. An
  SVG is a document that can carry a script rather than a picture, so it is refused here before
  the rule refuses it
*/
export const PROFILE_PICTURE_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

// In bytes. The account page refuses a larger file before sending it; the rule's own ceiling is
// higher, and is there for a caller that is not the page
export const MAX_PROFILE_PICTURE_SIZE = 2 * 1024 * 1024
