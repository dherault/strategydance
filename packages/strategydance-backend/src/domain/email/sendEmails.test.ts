import { beforeEach, describe, expect, mock, test } from 'bun:test'

type BatchCall = {
  payload: { to: string }[]
  options: { idempotencyKey: string, batchValidation: string }
}

type BatchResponse = {
  data: { data: { id: string }[], errors: { index: number, message: string }[] } | null
  error: { name: string, message: string, statusCode: number } | null
  headers: Record<string, string> | null
}

const calls: BatchCall[] = []

let respond: (call: BatchCall) => BatchResponse

// The production path, with Resend's SDK standing in for its API
mock.module('~constants', () => ({
  EMAIL_SENDER_ADDRESS: 'david@strategydance.com',
  IS_PRODUCTION: true,
  RESEND_API_KEY: 're_test',
}))

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

const { default: sendEmails } = await import('./sendEmails')

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

  test('makes no request for no emails', async () => {
    expect(await sendEmails([], 'key')).toEqual([])
    expect(calls).toHaveLength(0)
  })
})
