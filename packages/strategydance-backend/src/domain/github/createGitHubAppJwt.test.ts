import { describe, expect, test } from 'bun:test'
import { createVerify, generateKeyPairSync } from 'node:crypto'

import createGitHubAppJwt from '~domain/github/createGitHubAppJwt'

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})

describe('createGitHubAppJwt', () => {
  test('signs the App id, issued a minute back, for nine minutes', () => {
    const now = Date.UTC(2026, 9, 20, 5, 0, 0)
    const [header, payload, signature] = createGitHubAppJwt('123456', privateKey, now).split('.')

    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(JSON.parse(Buffer.from(payload, 'base64url').toString())).toEqual({
      iat: now / 1000 - 60,
      exp: now / 1000 + 8 * 60,
      iss: '123456',
    })
    expect(createVerify('RSA-SHA256').update(`${header}.${payload}`).verify(publicKey, signature, 'base64url')).toBe(
      true,
    )
  })
})
