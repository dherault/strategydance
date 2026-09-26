import { initializeApp } from 'firebase-admin/app'
import { getAppCheck } from 'firebase-admin/app-check'
import { getAuth } from 'firebase-admin/auth'
import { getDataConnect } from 'firebase-admin/data-connect'
import { getStorage } from 'firebase-admin/storage'
import { connectorConfig } from 'strategydance-database/backend'

import { FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET } from '~constants'

/*
  Application Default Credentials, so no key is stored anywhere. On Cloud Run they are the
  service's own account, which needs a Data Connect role to run the backend connector's
  operations and a Storage one to write the bucket. In development, `bun run dev:backend` sets
  `FIREBASE_AUTH_EMULATOR_HOST`, `DATA_CONNECT_EMULATOR_HOST` and
  `FIREBASE_STORAGE_EMULATOR_HOST`, which point Auth, Data Connect and Storage at the emulators,
  and no credential is needed at all
*/
const app = initializeApp({
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
})

export const authentication = getAuth(app)

export const appCheck = getAppCheck(app)

// The backend connector's, which is the only one this server calls. The service and location
// come from the generated SDK, so they cannot drift from `dataconnect.yaml`
export const dataConnect = getDataConnect(connectorConfig, app)

// Where organizations' pictures live. Storage rules do not bind the Admin SDK, which is why only
// this server writes there, after asking the database who may
export const bucket = getStorage(app).bucket()
