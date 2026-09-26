import { DEVELOPMENT_API_PORT, DEVELOPMENT_APP_URL, PRODUCTION_APP_URL } from 'strategydance-core'

/* ---
  ENVIRONMENT
--- */

// Set by the package's `dev` and `start` scripts, so a process started any other way is neither
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development'

export const IS_PRODUCTION = process.env.NODE_ENV === 'production'

// Cloud Run tells the container which port to listen on, and nothing else does
export const PORT = Number(process.env.PORT) || DEVELOPMENT_API_PORT

/* ---
  ARCHITECTURE
--- */

// Named rather than discovered, since a local run has no metadata server to ask
export const FIREBASE_PROJECT_ID = 'strategydance'

// The project's default bucket, the one the web app's config names too
export const FIREBASE_STORAGE_BUCKET = 'strategydance.firebasestorage.app'

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
  SECRETS

  Names in Secret Manager, in the `strategydance` project, read through `retrieveSecret`
--- */

// Read only in production, which is the only environment that sends email
export const SECRET_RESEND_API_KEY = 'resend-api-key'

/* ---
  EMAIL
--- */

/*
  Where every email comes from. Its domain has to stay verified in Resend, DKIM and SPF, or every
  send is refused, and the mailbox has to receive: the welcome email asks for a reply
*/
export const EMAIL_SENDER_ADDRESS = 'david@strategydance.com'
