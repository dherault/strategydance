import { createCipheriv, randomBytes } from 'node:crypto'

import { DEVELOPMENT_INTEGRATION_KEY, INTEGRATION_KMS_KEY_NAME, IS_PRODUCTION } from '~constants'

import getKmsClient from '~utils/getKmsClient'

import buildIntegrationKeyContext, { type IntegrationKeyOwner } from '~domain/integrations/buildIntegrationKeyContext'

/*
  An organization's key for an MCP server, encrypted for `OrganizationIntegration.encryptedApiKey`
  and bound to its organization and server: with Cloud KMS in production, `v1:kms:` and the
  ciphertext KMS answers, which names the key version it was made under, so a rotation needs nothing
  here; anywhere else with AES-256-GCM under a fixed local key, `v1:local:` and the nonce, the tag
  and the ciphertext. The prefix says which, so a row from development fails plainly in production.
  A KMS failure throws as the client throws it
*/
async function encryptIntegrationKey(key: string, owner: IntegrationKeyOwner) {
  const context = buildIntegrationKeyContext(owner)

  if (!IS_PRODUCTION) return `v1:local:${encryptLocally(key, context)}`

  const [response] = await getKmsClient().encrypt({
    name: INTEGRATION_KMS_KEY_NAME,
    plaintext: Buffer.from(key),
    additionalAuthenticatedData: context,
  })

  if (!response.ciphertext) throw new Error('Cloud KMS answered no ciphertext')

  return `v1:kms:${Buffer.from(response.ciphertext).toString('base64')}`
}

function encryptLocally(key: string, context: Buffer) {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(DEVELOPMENT_INTEGRATION_KEY, 'base64'), nonce)

  cipher.setAAD(context)

  const ciphertext = Buffer.concat([cipher.update(key, 'utf8'), cipher.final()])

  return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString('base64')
}

export default encryptIntegrationKey
