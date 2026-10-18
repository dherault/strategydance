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
  preview channel included, calls the deployed one. The modules' addresses hang off it too
*/
export const API_URL = EMULATORS_REQUESTED ? DEVELOPMENT_API_URL : PRODUCTION_API_URL

/*
  A refusal from the backend, carrying its status and its code for a caller to branch on, and how
  long until the same call can go, in milliseconds, when its `Retry-After` says, as a daily cap's
  refusal does: null otherwise
*/
export class ApiError extends Error {
  status: number
  code: string
  retryAfterMs: number | null

  constructor(status: number, code: string, message: string, retryAfterMs: number | null = null) {
    super(message)

    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.retryAfterMs = retryAfterMs
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

// The files `uploadApiFile` sends
type UploadApiFileOptions = {
  method: 'PUT' | 'POST'
  path: string
  // Sent as its own bytes and type
  file: Blob
  // Sent beside the file's type and the reader's tokens, as a file's name
  headers?: Record<string, string>
  // Told the share of the file sent so far, from 0 to 1, as it goes
  onProgress?: (share: number) => void
  // The account the file is that of, when it is sent later than it was picked: refused while any
  // other is signed in, so it never goes up as somebody else
  userId?: string
  // Aborts the upload
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
  The headers every call to the backend carries, as the signed-in reader.

  The ID token comes from the SDK, which refreshes it when it is about to expire, so a fresh one
  goes with every call. The App Check token goes along outside the emulators only: the local
  backend skips the check, and the debug token a development browser holds would only be refused.
  A call made for one account is refused while another is signed in
*/
async function createApiHeaders(userId?: string) {
  const user = authentication.currentUser

  if (!user) throw new ApiError(401, ERROR_CODE_UNAUTHORIZED_AUTHENTICATION, 'Nobody is signed in')

  if (userId !== undefined && user.uid !== userId) {
    throw new ApiError(401, ERROR_CODE_UNAUTHORIZED_AUTHENTICATION, 'Another account is signed in')
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${await user.getIdToken()}`,
  }

  if (!EMULATORS_REQUESTED && appCheck) {
    const { token } = await getToken(appCheck)

    headers[HEADER_APP_CHECK_TOKEN] = token
  }

  return headers
}

// How long a `Retry-After` header says to wait, in seconds or until a date, in milliseconds, or null
// when there is none or it says neither
export function readRetryAfter(value: string | null, now = Date.now()) {
  if (!value?.trim()) return null

  const seconds = Number(value)

  if (Number.isFinite(seconds)) return seconds >= 0 ? seconds * 1000 : null

  const date = Date.parse(value)

  return Number.isNaN(date) ? null : Math.max(0, date - now)
}

// The envelope's data, or the `ApiError` it says, from an answer's text read as JSON and its
// `Retry-After`
function readEnvelope<T>(status: number, payload: unknown, retryAfter: string | null = null) {
  const envelope = payload as ApiResponse<T>

  if (envelope.status === 'error') {
    throw new ApiError(status, envelope.code, envelope.message, readRetryAfter(retryAfter))
  }

  return envelope.data as T
}

// Something other than the backend answered, like a proxy's error page
function createUnreadableAnswerError(status: number) {
  return new ApiError(status, ERROR_CODE_UNKNOWN_ERROR, 'The server did not answer with JSON')
}

/*
  Calls the backend as the signed-in reader, and answers with the envelope's data or throws an
  `ApiError`, which carries the answer's `Retry-After`, which the backend lets the app's pages read.

  An aborted call rejects with the signal's reason, an `AbortError`, never an `ApiError`
*/
export async function requestApi<T = void>({ method, path, body, signal }: RequestApiOptions) {
  const headers = await createApiHeaders()
  const { requestBody, contentType } = encodeBody(body)

  if (contentType) headers['Content-Type'] = contentType

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: requestBody,
    signal,
  })

  let payload: unknown

  try {
    payload = await response.json()
  } catch (error) {
    // An abort while the answer was read is the caller's, not the server's
    if (signal?.aborted) throw error

    throw createUnreadableAnswerError(response.status)
  }

  return readEnvelope<T>(response.status, payload, response.headers.get('Retry-After'))
}

/*
  Reads a file's bytes from the backend as the signed-in reader, which an `<img>` pointed at the
  backend could not do, since it would carry no token. A refusal throws its `ApiError`, and an
  aborted read rejects with the signal's reason.

  Never through the browser's HTTP cache, which keys an answer by its address alone: another
  account signed in on the browser, or the reader once removed from the organization, would read
  the bytes back without the route checking who asks. Whatever keeps them does so by reader
*/
export async function requestApiFile({ path, signal }: { path: string; signal?: AbortSignal }) {
  const response = await fetch(`${API_URL}${path}`, { headers: await createApiHeaders(), cache: 'no-store', signal })

  if (response.ok) return response.blob()

  let payload: unknown

  try {
    payload = await response.json()
  } catch (error) {
    if (signal?.aborted) throw error

    throw createUnreadableAnswerError(response.status)
  }

  readEnvelope(response.status, payload, response.headers.get('Retry-After'))

  // An error's status with a success's envelope, which no backend answers
  throw createUnreadableAnswerError(response.status)
}

/*
  Sends a file to the backend as the signed-in reader, telling how far it has gone as it goes, and
  answers with the envelope's data or throws an `ApiError`. Through `XMLHttpRequest` rather than
  `fetch`, which says nothing of a body on its way. Once the last byte is sent, the share is 1
  while the backend stores the file.

  A connection lost on the way rejects with a `TypeError`, as `fetch` does, and an aborted upload
  with the signal's reason
*/
export async function uploadApiFile<T = void>({
  method,
  path,
  file,
  headers,
  onProgress,
  userId,
  signal,
}: UploadApiFileOptions) {
  const requestHeaders = {
    ...(await createApiHeaders(userId)),
    'Content-Type': file.type || 'application/octet-stream',
    ...headers,
  }

  signal?.throwIfAborted()

  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest()

    function abort() {
      request.abort()
    }

    function settle(outcome: () => void) {
      signal?.removeEventListener('abort', abort)
      outcome()
    }

    request.open(method, `${API_URL}${path}`)

    for (const [name, value] of Object.entries(requestHeaders)) request.setRequestHeader(name, value)

    request.upload.onprogress = event => {
      if (event.lengthComputable && event.total > 0) onProgress?.(event.loaded / event.total)
    }
    request.onload = () => {
      settle(() => {
        let payload: unknown

        try {
          payload = JSON.parse(request.responseText)
        } catch {
          reject(createUnreadableAnswerError(request.status))

          return
        }

        try {
          resolve(readEnvelope<T>(request.status, payload, request.getResponseHeader('Retry-After')))
        } catch (error) {
          reject(error)
        }
      })
    }
    request.onerror = () => settle(() => reject(new TypeError('The file could not reach the server')))
    request.onabort = () =>
      settle(() => reject(signal?.reason ?? new DOMException('The upload was aborted', 'AbortError')))

    signal?.addEventListener('abort', abort, { once: true })
    request.send(file)
  })
}
