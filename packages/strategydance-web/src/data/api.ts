import { getToken } from 'firebase/app-check'
import {
  type ApiResponse,
  DEVELOPMENT_API_URL,
  ERROR_CODE_UNAUTHORIZED_AUTHENTICATION,
  ERROR_CODE_UNKNOWN_ERROR,
  HEADER_APP_CHECK_TOKEN,
  PRODUCTION_API_URL,
} from 'strategydance-core'

import { EMULATORS_REQUESTED, appCheck, authentication } from '~data/firebase'

/*
  The local backend whenever the emulators are in use, because that is the backend talking to
  them: `bun run dev:backend` beside `bun run dev`, or `bun run preview`. Everything else, a
  preview channel included, calls the deployed one
*/
const API_URL = EMULATORS_REQUESTED ? DEVELOPMENT_API_URL : PRODUCTION_API_URL

// A refusal from the backend, carrying its status and its code for a caller to branch on
export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)

    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

type RequestApiOptions = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  body?: unknown
}

/*
  Calls the backend as the signed-in reader, and answers with the envelope's data or throws an
  `ApiError`.

  The ID token comes from the SDK, which refreshes it when it is about to expire, so a fresh one
  goes with every call. The App Check token goes along outside the emulators only: the local
  backend skips the check, and the debug token a development browser holds would only be refused
*/
export async function requestApi<T = void>({ method, path, body }: RequestApiOptions) {
  const user = authentication.currentUser

  if (!user) throw new ApiError(401, ERROR_CODE_UNAUTHORIZED_AUTHENTICATION, 'Nobody is signed in')

  const headers: Record<string, string> = {
    Authorization: `Bearer ${await user.getIdToken()}`,
  }

  if (body !== undefined) headers['Content-Type'] = 'application/json'

  if (!EMULATORS_REQUESTED && appCheck) {
    const { token } = await getToken(appCheck)

    headers[HEADER_APP_CHECK_TOKEN] = token
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  let payload: ApiResponse<T>

  try {
    payload = await response.json() as ApiResponse<T>
  }
  catch {
    // Something other than the backend answered, like a proxy's error page
    throw new ApiError(response.status, ERROR_CODE_UNKNOWN_ERROR, 'The server did not answer with JSON')
  }

  if (payload.status === 'error') throw new ApiError(response.status, payload.code, payload.message)

  return payload.data as T
}
