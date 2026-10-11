import { beforeEach, describe, expect, mock, test } from 'bun:test'

type AccessRequest = { name: string }

const versions: Record<string, { name: string; payload: { data: Buffer } | null }> = {}
const accessSecretVersion = mock(async ({ name }: AccessRequest) => {
  const version = versions[name]

  if (!version) throw new Error(`NOT_FOUND: ${name}`)

  return [version]
})

mock.module('@google-cloud/secret-manager', () => ({
  SecretManagerServiceClient: class {
    accessSecretVersion = accessSecretVersion
  },
}))

const { default: retrieveSecretVersion } = await import('./retrieveSecretVersion')

const PREFIX = 'projects/strategydance/secrets'

function store(name: string, number: number, value: string | null, { isLatest = false } = {}) {
  const version = {
    name: `${PREFIX}/${name}/versions/${number}`,
    payload: value === null ? null : { data: Buffer.from(value) },
  }

  versions[`${PREFIX}/${name}/versions/${number}`] = version

  if (isLatest) versions[`${PREFIX}/${name}/versions/latest`] = version
}

describe('retrieveSecretVersion', () => {
  beforeEach(() => {
    accessSecretVersion.mockClear()
  })

  test('reads the latest version with its number, once for the life of the process', async () => {
    store('latest-secret', 3, 'third', { isLatest: true })

    expect(await retrieveSecretVersion('latest-secret')).toEqual({ value: 'third', version: 3 })
    expect(await retrieveSecretVersion('latest-secret')).toEqual({ value: 'third', version: 3 })
    expect(accessSecretVersion).toHaveBeenCalledTimes(1)
  })

  test("answers the latest's number from the same read", async () => {
    store('known-secret', 5, 'fifth', { isLatest: true })

    await retrieveSecretVersion('known-secret')

    expect(await retrieveSecretVersion('known-secret', 5)).toEqual({ value: 'fifth', version: 5 })
    expect(accessSecretVersion).toHaveBeenCalledTimes(1)
  })

  test('reads a numbered version beside the latest, each kept apart', async () => {
    store('rotated-secret', 1, 'first')
    store('rotated-secret', 2, 'second', { isLatest: true })

    expect(await retrieveSecretVersion('rotated-secret')).toEqual({ value: 'second', version: 2 })
    expect(await retrieveSecretVersion('rotated-secret', 1)).toEqual({ value: 'first', version: 1 })
    expect(await retrieveSecretVersion('rotated-secret', 1)).toEqual({ value: 'first', version: 1 })
    expect(accessSecretVersion).toHaveBeenCalledTimes(2)
    expect(accessSecretVersion.mock.calls[1]?.[0]).toEqual({ name: `${PREFIX}/rotated-secret/versions/1` })
  })

  test('throws on an empty secret, and caches nothing', async () => {
    store('empty-secret', 1, '', { isLatest: true })

    expect(retrieveSecretVersion('empty-secret')).rejects.toThrow(
      'Secret empty-secret is empty or has no version latest',
    )
    expect(retrieveSecretVersion('empty-secret')).rejects.toThrow()
    expect(accessSecretVersion).toHaveBeenCalledTimes(2)
  })

  test('throws on a version that does not exist', async () => {
    expect(retrieveSecretVersion('missing-secret', 7)).rejects.toThrow('NOT_FOUND')
  })
})
