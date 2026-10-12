import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { ERROR_CODE_TOO_MANY_PENDING_ATTACHMENTS, ERROR_CODE_UNKNOWN_ERROR } from 'strategydance-core'

// A signed-in reader whose token the calls carry, and no App Check, as against the emulators
mock.module('~data/firebase', () => ({
  EMULATORS_REQUESTED: true,
  appCheck: null,
  authentication: { currentUser: { getIdToken: async () => 'id-token' } },
}))

const { API_URL, ApiError, requestApiFile, uploadApiFile } = await import('~data/api')

type ProgressHandler = (event: { lengthComputable: boolean; loaded: number; total: number }) => void

// An `XMLHttpRequest` the test answers by hand, as the browser's would as the upload goes
class FakeXMLHttpRequest {
  static latest: FakeXMLHttpRequest | null = null

  method = ''
  url = ''
  headers: Record<string, string> = {}
  body: unknown = null
  status = 0
  responseText = ''
  isAborted = false
  upload: { onprogress: ProgressHandler | null } = { onprogress: null }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null

  constructor() {
    FakeXMLHttpRequest.latest = this
  }

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value
  }

  send(body: unknown) {
    this.body = body
  }

  abort() {
    this.isAborted = true
    this.onabort?.()
  }

  answer(status: number, payload: unknown) {
    this.status = status
    this.responseText = typeof payload === 'string' ? payload : JSON.stringify(payload)
    this.onload?.()
  }
}

const originalXMLHttpRequest = globalThis.XMLHttpRequest
const originalFetch = globalThis.fetch

// Answers every `fetch` with what the test says
function stubFetch(answer: (url: string, init?: RequestInit) => Promise<Response>) {
  globalThis.fetch = answer as unknown as typeof fetch
}

// Lets the headers' tokens be read before the request goes
async function sent() {
  for (let round = 0; round < 5; round++) await Promise.resolve()

  const request = FakeXMLHttpRequest.latest

  if (!request) throw new Error('Nothing was sent')

  return request
}

beforeEach(() => {
  FakeXMLHttpRequest.latest = null
  globalThis.XMLHttpRequest = FakeXMLHttpRequest as unknown as typeof XMLHttpRequest
})

afterEach(() => {
  globalThis.XMLHttpRequest = originalXMLHttpRequest
  globalThis.fetch = originalFetch
})

describe('uploadApiFile', () => {
  test('sends the file with its type, the headers given and the token, telling how far it has gone', async () => {
    const file = new Blob(['%PDF-1.7'], { type: 'application/pdf' })
    const shares: number[] = []
    const upload = uploadApiFile<{ id: string }>({
      method: 'PUT',
      path: '/files/1',
      file,
      headers: { 'X-File-Name': 'plan.pdf' },
      onProgress: share => shares.push(share),
    })
    const request = await sent()

    expect(request.method).toBe('PUT')
    expect(request.url).toBe(`${API_URL}/files/1`)
    expect(request.headers).toEqual({
      Authorization: 'Bearer id-token',
      'Content-Type': 'application/pdf',
      'X-File-Name': 'plan.pdf',
    })
    expect(request.body).toBe(file)

    request.upload.onprogress?.({ lengthComputable: true, loaded: 2, total: 8 })
    request.upload.onprogress?.({ lengthComputable: false, loaded: 0, total: 0 })
    request.upload.onprogress?.({ lengthComputable: true, loaded: 8, total: 8 })
    request.answer(201, { status: 'success', data: { id: '1' } })

    expect(await upload).toEqual({ id: '1' })
    expect(shares).toEqual([0.25, 1])
  })

  test("throws the backend's refusal as an ApiError, and an answer that is not JSON as an unknown one", async () => {
    const refused = uploadApiFile({ method: 'PUT', path: '/files/1', file: new Blob(['a']) })

    ;(await sent()).answer(409, { status: 'error', code: ERROR_CODE_TOO_MANY_PENDING_ATTACHMENTS, message: 'Too many' })

    await expect(refused).rejects.toEqual(new ApiError(409, ERROR_CODE_TOO_MANY_PENDING_ATTACHMENTS, 'Too many'))

    const unreadable = uploadApiFile({ method: 'PUT', path: '/files/1', file: new Blob(['a']) })

    ;(await sent()).answer(502, '<html>Bad gateway</html>')

    const error = await unreadable.catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 502, code: ERROR_CODE_UNKNOWN_ERROR })
  })

  test('rejects with a TypeError when the connection is lost, and with the reason when aborted', async () => {
    const lost = uploadApiFile({ method: 'PUT', path: '/files/1', file: new Blob(['a']) })

    ;(await sent()).onerror?.()

    await expect(lost).rejects.toBeInstanceOf(TypeError)

    const controller = new AbortController()
    const aborted = uploadApiFile({ method: 'PUT', path: '/files/1', file: new Blob(['a']), signal: controller.signal })
    const request = await sent()
    const reason = new DOMException('Removed', 'AbortError')

    controller.abort(reason)

    expect(request.isAborted).toBe(true)
    await expect(aborted).rejects.toBe(reason)
  })
})

describe('requestApiFile', () => {
  test("answers the file's bytes, with the token", async () => {
    let headers: HeadersInit | undefined

    stubFetch(async (_url, init) => {
      headers = init?.headers

      return new Response('bytes', { headers: { 'Content-Type': 'image/png' } })
    })

    const blob = await requestApiFile({ path: '/files/1' })

    expect(await blob.text()).toBe('bytes')
    expect(blob.type).toBe('image/png')
    expect(headers).toEqual({ Authorization: 'Bearer id-token' })
  })

  test('throws a refusal as an ApiError, and an answer that is not JSON as an unknown one', async () => {
    stubFetch(async () => Response.json({ status: 'error', code: 'NOT_FOUND', message: 'Gone' }, { status: 404 }))

    await expect(requestApiFile({ path: '/files/1' })).rejects.toEqual(new ApiError(404, 'NOT_FOUND', 'Gone'))

    stubFetch(async () => new Response('<html>Bad gateway</html>', { status: 502 }))

    await expect(requestApiFile({ path: '/files/1' })).rejects.toMatchObject({
      status: 502,
      code: ERROR_CODE_UNKNOWN_ERROR,
    })
  })
})
