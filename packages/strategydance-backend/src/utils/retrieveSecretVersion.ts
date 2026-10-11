import { SecretManagerServiceClient } from '@google-cloud/secret-manager'

import { FIREBASE_PROJECT_ID } from '~constants'

// Application Default Credentials, like the Firebase Admin SDK: on Cloud Run the service's own
// account, which needs Secret Manager's accessor role on each secret it reads
const client = new SecretManagerServiceClient()

type SecretVersion = {
  value: string
  version: number
}

/*
  Cached for the life of the process, since Secret Manager bills per access: a numbered version
  never changes, and `latest` is kept as the version it was when first read, so a rotated secret
  reaches the backend when its Cloud Run revision is replaced, not before. Keyed by the name and
  the version asked for, `latest` beside the numbers
*/
const cache = new Map<string, SecretVersion>()

/*
  A secret's value and the version it was, from Secret Manager in the project the backend runs in:
  its latest version unless a number says which, as a token derived under one version is derived
  again under the same, whichever an instance holds as its latest. Throws when the secret or the
  version is missing, disabled or empty, so a misconfigured deploy fails where the secret is needed
  rather than sending an empty key along
*/
async function retrieveSecretVersion(name: string, version: number | 'latest' = 'latest') {
  const key = `${name}/${version}`
  const cached = cache.get(key)

  if (cached) return cached

  const [response] = await client.accessSecretVersion({
    name: `projects/${FIREBASE_PROJECT_ID}/secrets/${name}/versions/${version}`,
  })

  const value = response.payload?.data?.toString()

  if (!value) throw new Error(`Secret ${name} is empty or has no version ${version}`)

  // The version's own name ends in its number, which is what `latest` resolved to
  const number = Number(response.name?.split('/').pop())

  if (!Number.isInteger(number)) throw new Error(`Secret ${name} answered no version number`)

  const secretVersion = { value, version: number }

  cache.set(key, secretVersion)
  cache.set(`${name}/${number}`, secretVersion)

  return secretVersion
}

export default retrieveSecretVersion
