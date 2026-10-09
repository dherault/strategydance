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
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  // Sent as JSON, except a `Blob`, like a `File`, which is sent as its own bytes and type, and a
  // `FormData`, which is sent as a multipart form
  body?: unknown
  // Aborts the request, and the read of its answer, as a newer one replaces it
  signal?: AbortSignal
}

// What goes over the wire for a body, and the type it goes as
function encodeBody(body: unknown) {
  if (body === undefined) return { requestBody: undefined, contentType: null }

  if (body instanceof Blob) return { requestBody: body, contentType: body.type || 'application/octet-stream' }

  // No type of its own: the browser writes one, naming the boundary between the form's parts
  if (body instanceof FormData) return { requestBody: body, contentType: null }

  return { requestBody: JSON.stringify(body), contentType: 'application/json' }
}

/*
  Calls the backend as the signed-in reader, and answers with the envelope's data or throws an
  `ApiError`.

  The ID token comes from the SDK, which refreshes it when it is about to expire, so a fresh one
  goes with every call. The App Check token goes along outside the emulators only: the local
  backend skips the check, and the debug token a development browser holds would only be refused.

  An aborted call rejects with the signal's reason, an `AbortError`, never an `ApiError`
*/
export async function requestApi<T = void>({ method, path, body, signal }: RequestApiOptions) {
  const user = authentication.currentUser

  if (!user) throw new ApiError(401, ERROR_CODE_UNAUTHORIZED_AUTHENTICATION, 'Nobody is signed in')

  const { requestBody, contentType } = encodeBody(body)

  const headers: Record<string, string> = {
    Authorization: `Bearer ${await user.getIdToken()}`,
  }

  if (contentType) headers['Content-Type'] = contentType

  if (!EMULATORS_REQUESTED && appCheck) {
    const { token } = await getToken(appCheck)

    headers[HEADER_APP_CHECK_TOKEN] = token
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: requestBody,
    signal,
  })

  let payload: ApiResponse<T>

  try {
    payload = (await response.json()) as ApiResponse<T>
  } catch (error) {
    // An abort while the answer was read is the caller's, not the server's
    if (signal?.aborted) throw error

    // Something other than the backend answered, like a proxy's error page
    throw new ApiError(response.status, ERROR_CODE_UNKNOWN_ERROR, 'The server did not answer with JSON')
  }

  if (payload.status === 'error') throw new ApiError(response.status, payload.code, payload.message)

  return payload.data as T
}
