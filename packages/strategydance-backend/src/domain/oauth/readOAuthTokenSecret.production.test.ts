import { afterAll, describe, expect, mock, test } from 'bun:test'

const retrieveSecretVersion = mock(async (_name: string, version?: number) => ({
  value: `version ${version ?? 'latest'}`,
  version: version ?? 4,
}))

mock.module('~utils/retrieveSecretVersion', () => ({ default: retrieveSecretVersion }))

const nodeEnvironment = process.env.NODE_ENV

process.env.NODE_ENV = 'production'

const { default: readOAuthTokenSecret } = await import('./readOAuthTokenSecret')

afterAll(() => {
  process.env.NODE_ENV = nodeEnvironment
})

describe('readOAuthTokenSecret in production', () => {
  test('reads `oauth-token-secret`, its latest version or the one named', async () => {
    expect(await readOAuthTokenSecret()).toEqual({ value: 'version latest', version: 4 })
    expect(await readOAuthTokenSecret(2)).toEqual({ value: 'version 2', version: 2 })
    expect(retrieveSecretVersion.mock.calls).toEqual([
      ['oauth-token-secret', undefined],
      ['oauth-token-secret', 2],
    ])
  })
})
