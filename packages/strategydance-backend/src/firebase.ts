import { initializeApp } from 'firebase-admin/app'
import { getAppCheck } from 'firebase-admin/app-check'
import { getAuth } from 'firebase-admin/auth'
import { getDataConnect } from 'firebase-admin/data-connect'
import { connectorConfig } from 'strategydance-database/backend'

import { FIREBASE_PROJECT_ID } from '~constants'

/*
  Application Default Credentials, so no key is stored anywhere. On Cloud Run they are the
  service's own account, which needs a Data Connect role to run the backend connector's
  operations. In development, `bun run dev:backend` sets `FIREBASE_AUTH_EMULATOR_HOST` and
  `DATA_CONNECT_EMULATOR_HOST`, which point Auth and Data Connect at the emulators, and no
  credential is needed at all
*/
const app = initializeApp({ projectId: FIREBASE_PROJECT_ID })

export const authentication = getAuth(app)

export const appCheck = getAppCheck(app)

// The backend connector's, which is the only one this server calls. The service and location
// come from the generated SDK, so they cannot drift from `dataconnect.yaml`
export const dataConnect = getDataConnect(connectorConfig, app)
