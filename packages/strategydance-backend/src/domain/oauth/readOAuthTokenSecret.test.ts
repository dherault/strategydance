import { describe, expect, mock, test } from 'bun:test'

const retrieveSecretVersion = mock(async () => ({ value: 'production', version: 4 }))

mock.module('~utils/retrieveSecretVersion', () => ({ default: retrieveSecretVersion }))

const { default: readOAuthTokenSecret } = await import('./readOAuthTokenSecret')

describe('readOAuthTokenSecret', () => {
  test('answers the fixed local value outside production, reading no secret', async () => {
    expect(await readOAuthTokenSecret()).toEqual({
      value: 'strategydance-development-oauth-token-secret',
      version: 1,
    })
    expect(await readOAuthTokenSecret(3)).toEqual({ value: 'strategydance-development-oauth-token-secret', version: 1 })
    expect(retrieveSecretVersion).not.toHaveBeenCalled()
  })
})
