import { initializeApp } from 'firebase/app'
import { ReCaptchaV3Provider, initializeAppCheck } from 'firebase/app-check'
import { GoogleAuthProvider, connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectDataConnectEmulator, getDataConnect, makeMemoryCacheProvider } from 'firebase/data-connect'
import { connectorConfig } from 'strategydance-database/web'
import { getPerformance } from 'firebase/performance'
import { connectStorageEmulator, getStorage } from 'firebase/storage'

/*
  SPA mode prerenders the document shell in Node at build time, and the route tree really is
  rendered there, so every module a route imports is evaluated with no `window` at all. Half of
  what follows reaches for one: App Check reads `self` and mounts a reCAPTCHA script,
  Performance reads `document`, and an emulator connection opens a socket nothing in a build
  should open. Each of those is guarded; the plain `get*` calls are pure enough to run anywhere
*/
const isBrowser = typeof window !== 'undefined'

/*
  Development always talks to the emulators, and `bun run preview` does too even though its
  bundle is a production build: it is served by the Hosting emulator from a machine that has
  the others running, and a local preview that signs people into the real project and writes
  real rows is a trap rather than a preview.

  Both halves are inlined by Vite, so this folds to a literal at build time and a real
  production build drops the emulator wiring rather than shipping it as unreachable code.
  That is also why it is tested before `isBrowser` everywhere below: a runtime value first
  would stop the bundler folding the branch away
*/
const EMULATORS_REQUESTED = import.meta.env.DEV || import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'

/* ---
  Firebase app
--- */

// Public by design. An apiKey identifies the project rather than authorizing anything, and what
// actually guards the backend is the storage rules, the `@auth` level on every Data Connect
// operation, and App Check, which only counts once enforcement is switched on per service in
// the Firebase console. Initializing it here attaches a token and nothing more
const firebaseConfig = {
  apiKey: 'AIzaSyD4xUIFDDOo2KVV7AtsR9VdKoIZZbqBS28',
  authDomain: 'strategydance.firebaseapp.com',
  projectId: 'strategydance',
  storageBucket: 'strategydance.firebasestorage.app',
  messagingSenderId: '995028545701',
  appId: '1:995028545701:web:ca05d373b310f928e39d4c',
  measurementId: 'G-T7T8H3HBN8',
}

const app = initializeApp(firebaseConfig)

/* ---
  App check
--- */

const RECAPTCHA_SITE_KEY = '6Le_U8ktAAAAAKOb3jO0d3PRWVjCSXZnXwm7cn33'

/*
  The debug provider prints a token to the console on first run, which has to be registered in
  the Firebase console before this browser can talk to the real project. The emulators do not
  enforce App Check, so the usual dev loop never needs it.
  https://firebase.google.com/docs/app-check/web/debug-provider#localhost
*/
if (EMULATORS_REQUESTED && isBrowser) {
  // @ts-expect-error `FIREBASE_APPCHECK_DEBUG_TOKEN` is read off the global object by the SDK
  self.FIREBASE_APPCHECK_DEBUG_TOKEN ??= true
}

// Null in the build's Node pass, so anything reading a token has to cope with not having one
export const appCheck = isBrowser
  ? initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    })
  : null

/* ---
  Authentication
--- */

export const authentication = getAuth(app)

export const googleProvider = new GoogleAuthProvider()

googleProvider.addScope('email')
googleProvider.addScope('profile')

/* ---
  Data Connect
--- */

/*
  The service, location and connector come from the generated SDK rather than being written
  out again here. They are how the SDK addresses a deployed service, so a copy that drifted
  from `dataconnect.yaml` would fail at runtime against a service that exists.

  `maxAgeSeconds: 0` turns the SDK's own cache off, and it is not an optimization being
  declined. TanStack Query is already the cache: the generated React hooks call
  `executeQuery(ref)` with no fetch policy, so a second cache sits underneath the first and
  answers `PREFER_CACHE` from it. A refetch after a mutation then returns what was true before
  the mutation, and the worst case is not staleness but a hang: a reader who has just signed up
  refetches the row that was absent a moment ago, is told it is still absent, and `UserWait`
  holds the tree forever
*/
export const dataConnect = getDataConnect(app, connectorConfig, {
  cacheSettings: {
    cacheProvider: makeMemoryCacheProvider(),
    maxAgeSeconds: 0,
  },
})

/* ---
  Storage
--- */

export const storage = getStorage(app)

/* ---
  Performance
--- */

if (!EMULATORS_REQUESTED && isBrowser && import.meta.env.PROD) {
  getPerformance(app)
}

/* ---
  Emulators
--- */

// `bun run dev` wants `bun run dev:emulators` beside it; `bun run preview` starts its own
if (EMULATORS_REQUESTED && isBrowser) {
  console.log('🔥 Using Firebase emulators')

  connectAuthEmulator(authentication, 'http://localhost:9099', { disableWarnings: true })
  connectDataConnectEmulator(dataConnect, 'localhost', 9399, false)
  connectStorageEmulator(storage, 'localhost', 9199)
}
