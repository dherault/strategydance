import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'

import checkPkceChallenge from './checkPkceChallenge'
import verifyPkce from './verifyPkce'

const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
const challenge = createHash('sha256').update(verifier).digest('base64url')

describe('checkPkceChallenge', () => {
  test('takes an S256 challenge, named', () => {
    expect(checkPkceChallenge(challenge, 'S256')).toBe(true)
  })

  test('refuses plain, a method unnamed, and a challenge S256 would not write', () => {
    expect(checkPkceChallenge(verifier, 'plain')).toBe(false)
    expect(checkPkceChallenge(challenge, undefined)).toBe(false)
    expect(checkPkceChallenge(undefined, 'S256')).toBe(false)
    expect(checkPkceChallenge(`${challenge}=`, 'S256')).toBe(false)
    expect(checkPkceChallenge(challenge.slice(1), 'S256')).toBe(false)
  })
})

describe('verifyPkce', () => {
  test("takes the challenge's verifier", () => {
    expect(verifyPkce(verifier, challenge)).toBe(true)
  })

  test('refuses another verifier, none, the challenge itself and one RFC 7636 would not write', () => {
    expect(verifyPkce(`${verifier.slice(0, -1)}A`, challenge)).toBe(false)
    expect(verifyPkce(undefined, challenge)).toBe(false)
    expect(verifyPkce(challenge, challenge)).toBe(false)
    expect(verifyPkce('short', createHash('sha256').update('short').digest('base64url'))).toBe(false)
  })
})
