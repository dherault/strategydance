import { describe, expect, test } from 'bun:test'

import parseOAuthParameters from './parseOAuthParameters'

describe('parseOAuthParameters', () => {
  test('reads the names asked for, and nothing else', () => {
    expect(
      parseOAuthParameters('grant_type=authorization_code&code=abc&refresh_token=xyz', ['grant_type', 'code']),
    ).toEqual({ isRepeated: false, values: { grant_type: 'authorization_code', code: 'abc' } })
  })

  test('refuses any parameter repeated, one it does not read included, an empty copy included', () => {
    for (const name of ['state', 'code_verifier', 'client_id', 'resource', 'grant_type', 'response_type', 'other']) {
      expect(parseOAuthParameters(`${name}=a&code=b&${name}=c`, ['code'])).toEqual({ isRepeated: true, name })
      expect(parseOAuthParameters(`${name}=a&${name}=`, ['code'])).toEqual({ isRepeated: true, name })
    }
  })

  test('counts a parameter without a value as not sent', () => {
    expect(parseOAuthParameters('state=&code=b', ['state', 'code'])).toEqual({
      isRepeated: false,
      values: { code: 'b' },
    })
  })

  test('decodes what a form or a query encodes', () => {
    expect(
      parseOAuthParameters('redirect_uri=http%3A%2F%2F127.0.0.1%3A1234%2Fcb&scope=a+b', ['redirect_uri', 'scope']),
    ).toEqual({
      isRepeated: false,
      values: { redirect_uri: 'http://127.0.0.1:1234/cb', scope: 'a b' },
    })
  })
})
