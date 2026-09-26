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
