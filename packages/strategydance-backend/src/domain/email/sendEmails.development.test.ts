import fs from 'node:fs/promises'
import os from 'node:os'

import { afterEach, describe, expect, mock, test } from 'bun:test'

// Outside production: its own file, since `sendEmails.test.ts` mocks the opposite
const retrieveSecret = mock(async () => 're_test')

const resendConstructed = mock(() => {})

const logged: string[] = []

mock.module('~constants', () => ({
  EMAIL_SENDER_ADDRESS: 'david@strategydance.com',
  IS_PRODUCTION: false,
  SECRET_RESEND_API_KEY: 'resend-api-key',
}))

mock.module('~utils/retrieveSecret', () => ({ default: retrieveSecret }))

mock.module('~utils/logger', () => ({
  default: { info: (message: string) => logged.push(message), warn: () => {}, error: () => {} },
}))

mock.module('resend', () => ({
  Resend: class {
    constructor() {
      resendConstructed()
    }
  },
}))

const { default: sendEmails } = await import('./sendEmails')

// The files the logged lines point at
function loggedFiles() {
  return logged.map(line => line.match(/file:\/\/(\S+)$/)?.[1]).filter((file): file is string => Boolean(file))
}

afterEach(async () => {
  await Promise.all(loggedFiles().map(file => fs.rm(file, { force: true })))

  logged.length = 0
})

describe('sendEmails outside production', () => {
  test('writes each email to the temp directory and sends nothing', async () => {
    const failures = await sendEmails([
      { senderName: 'Strategy Dance', to: 'ada@example.com', subject: 'First', html: '<p>First</p>', text: 'First' },
      { senderName: 'Strategy Dance', to: 'grace@example.com', subject: 'Second', html: '<p>Second</p>', text: 'Second' },
    ], 'key')

    expect(failures).toEqual([])
    expect(retrieveSecret).not.toHaveBeenCalled()
    expect(resendConstructed).not.toHaveBeenCalled()

    const files = loggedFiles()

    expect(files).toHaveLength(2)
    expect(files.every(file => file.startsWith(os.tmpdir()))).toBe(true)
    // Written in parallel, so logged in whichever order they finish
    expect(logged.some(line => line.includes('"First" to ada@example.com'))).toBe(true)

    const contents = await Promise.all(files.map(file => fs.readFile(file, 'utf-8')))

    expect(contents.sort()).toEqual(['<p>First</p>', '<p>Second</p>'])
  })
})
