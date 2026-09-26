import { SecretManagerServiceClient } from '@google-cloud/secret-manager'

import { FIREBASE_PROJECT_ID } from '~constants'

// Application Default Credentials, like the Firebase Admin SDK: on Cloud Run the service's own
// account, which needs Secret Manager's accessor role on each secret it reads
const client = new SecretManagerServiceClient()

// Cached for the life of the process, since Secret Manager bills per access. So a rotated secret
// reaches the backend when its Cloud Run revision is replaced, not before
const cache = new Map<string, string>()

/*
  A secret's latest version, from Secret Manager in the project the backend runs in. Throws when
  the secret is missing or empty, so a misconfigured deploy fails where the secret is needed rather
  than sending an empty key along
*/
async function retrieveSecret(name: string) {
  const cached = cache.get(name)

  if (cached) return cached

  const [version] = await client.accessSecretVersion({
    name: `projects/${FIREBASE_PROJECT_ID}/secrets/${name}/versions/latest`,
  })

  const payload = version.payload?.data?.toString()

  if (!payload) throw new Error(`Secret ${name} is empty or has no version`)

  cache.set(name, payload)

  return payload
}

export default retrieveSecret
