import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'

type BatchCall = {
  payload: { to: string }[]
  options: { idempotencyKey: string, batchValidation: string }
}

type BatchResponse = {
  data: { data: { id: string }[], errors: { index: number, message: string }[] } | null
  error: { name: string, message: string, statusCode: number | null } | null
  headers: Record<string, string> | null
}

const calls: BatchCall[] = []

let respond: (call: BatchCall) => BatchResponse

// The production path, with Resend's SDK standing in for its API
mock.module('~constants', () => ({
  EMAIL_SENDER_ADDRESS: 'david@strategydance.com',
  IS_PRODUCTION: true,
  SECRET_RESEND_API_KEY: 'resend-api-key',
}))

mock.module('~utils/retrieveSecret', () => ({ default: async () => 're_test' }))

mock.module('~utils/logger', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {} },
}))

mock.module('resend', () => ({
  Resend: class {
    batch = {
      send: async (payload: BatchCall['payload'], options: BatchCall['options']) => {
        const call = { payload, options }

        calls.push(call)

        return respond(call)
      },
    }
  },
}))

// The waits between retries, skipped
spyOn(Bun, 'sleep').mockResolvedValue(undefined)

const { default: sendEmails } = await import('./sendEmails')

const { default: UnknownDeliveryError } = await import('./UnknownDeliveryError')

function makeEmails(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    senderName: 'Strategy Dance',
    to: `person${index}@example.com`,
    subject: `Email ${index}`,
    html: '<p>Hi</p>',
    text: 'Hi',
  }))
}

function accept({ payload }: BatchCall): BatchResponse {
  return {
    data: { data: payload.map((_, index) => ({ id: String(index) })), errors: [] },
    error: null,
    headers: null,
  }
}

beforeEach(() => {
  calls.length = 0
  respond = accept
})

describe('sendEmails', () => {
  test('sends up to a hundred emails a request, each with its own key, permissively', async () => {
    const failures = await sendEmails(makeEmails(150), 'invitations/abc')

    expect(failures).toEqual([])
    expect(calls.map(({ payload }) => payload.length)).toEqual([100, 50])
    expect(calls.map(({ options }) => options.idempotencyKey)).toEqual(['invitations/abc/0', 'invitations/abc/1'])
    expect(calls.every(({ options }) => options.batchValidation === 'permissive')).toBe(true)
    expect(calls[0].payload[0]).toMatchObject({ from: 'Strategy Dance <david@strategydance.com>', to: 'person0@example.com' })
  })

  test('answers with the emails Resend refused, indexed in the whole list', async () => {
    respond = call => {
      const response = accept(call)

      // The second batch starts at index 100
      if (call.options.idempotencyKey.endsWith('/1')) response.data!.errors = [{ index: 2, message: 'Invalid `to` field' }]

      return response
    }

    const failures = await sendEmails(makeEmails(150), 'key')

    expect(failures).toEqual([{ index: 102, message: 'Invalid `to` field' }])
  })

  test('sends again after the wait Resend asks for when it limits the rate', async () => {
    let refusals = 2

    respond = call => {
      if (refusals-- > 0) return { data: null, error: { name: 'rate_limit_exceeded', message: 'Too many requests', statusCode: 429 }, headers: { 'retry-after': '0' } }

      return accept(call)
    }

    expect(await sendEmails(makeEmails(1), 'key')).toEqual([])
    expect(calls).toHaveLength(3)
  })

  test('throws when Resend refuses the request, or keeps limiting its rate', async () => {
    respond = () => ({ data: null, error: { name: 'invalid_from_address', message: 'Unverified domain', statusCode: 403 }, headers: null })

    await expect(sendEmails(makeEmails(1), 'key')).rejects.toThrow('invalid_from_address')
    expect(calls).toHaveLength(1)

    calls.length = 0
    respond = () => ({ data: null, error: { name: 'rate_limit_exceeded', message: 'Too many requests', statusCode: 429 }, headers: { 'retry-after': '0' } })

    await expect(sendEmails(makeEmails(1), 'key')).rejects.toThrow('rate_limit_exceeded')
    // The first request and its three retries
    expect(calls).toHaveLength(4)
  })

  test('sends again under the same key when Resend did not answer, since it may have taken the request', async () => {
    let lost = 1

    respond = call => {
      if (lost-- > 0) return { data: null, error: { name: 'application_error', message: 'Unable to fetch data', statusCode: null }, headers: null }

      return accept(call)
    }

    expect(await sendEmails(makeEmails(1), 'key')).toEqual([])
    expect(calls.map(({ options }) => options.idempotencyKey)).toEqual(['key/0', 'key/0'])
  })

  test('throws an unknown delivery, not a refusal, when Resend never answers', async () => {
    respond = () => ({ data: null, error: { name: 'internal_server_error', message: 'Internal server error', statusCode: 500 }, headers: null })

    await expect(sendEmails(makeEmails(1), 'key')).rejects.toBeInstanceOf(UnknownDeliveryError)
    expect(calls).toHaveLength(4)
  })

  test('does not take a refusal for an unknown delivery', async () => {
    respond = () => ({ data: null, error: { name: 'validation_error', message: 'Invalid `from` field', statusCode: 422 }, headers: null })

    const refusal = await sendEmails(makeEmails(1), 'key').catch(error => error)

    expect(refusal).not.toBeInstanceOf(UnknownDeliveryError)
    expect(calls).toHaveLength(1)
  })

  test('makes no request for no emails', async () => {
    expect(await sendEmails([], 'key')).toEqual([])
    expect(calls).toHaveLength(0)
  })
})
