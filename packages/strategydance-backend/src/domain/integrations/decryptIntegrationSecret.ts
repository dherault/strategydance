import { createDecipheriv } from 'node:crypto'

import { DEVELOPMENT_INTEGRATION_KEY, INTEGRATION_KMS_KEY_NAME, IS_PRODUCTION } from '~constants'

import getKmsClient from '~utils/getKmsClient'

import buildIntegrationSecretContext, {
  type IntegrationSecretOwner,
} from '~domain/integrations/buildIntegrationSecretContext'

const KMS_PREFIX = 'v1:kms:'

const LOCAL_PREFIX = 'v1:local:'

/*
  The secret `encryptIntegrationSecret` encrypted for this purpose and owner. One encrypted for
  another row, another purpose or another member, or tampered with, fails to open, and so does one
  encrypted elsewhere than where it is read: Cloud KMS's in production alone, the local key's anywhere
  else
*/
async function decryptIntegrationSecret(encrypted: string, owner: IntegrationSecretOwner) {
  const context = buildIntegrationSecretContext(owner)

  if (IS_PRODUCTION) {
    if (!encrypted.startsWith(KMS_PREFIX)) throw new Error('A secret not encrypted with Cloud KMS')

    const [response] = await getKmsClient().decrypt({
      name: INTEGRATION_KMS_KEY_NAME,
      ciphertext: Buffer.from(encrypted.slice(KMS_PREFIX.length), 'base64'),
      additionalAuthenticatedData: context,
    })

    if (!response.plaintext) throw new Error('Cloud KMS answered no plaintext')

    return Buffer.from(response.plaintext).toString('utf8')
  }

  if (!encrypted.startsWith(LOCAL_PREFIX)) throw new Error('A secret not encrypted with the local key')

  return decryptLocally(Buffer.from(encrypted.slice(LOCAL_PREFIX.length), 'base64'), context)
}

function decryptLocally(sealed: Buffer, context: Buffer) {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(DEVELOPMENT_INTEGRATION_KEY, 'base64'),
    sealed.subarray(0, 12),
  )

  decipher.setAAD(context)
  decipher.setAuthTag(sealed.subarray(12, 28))

  return Buffer.concat([decipher.update(sealed.subarray(28)), decipher.final()]).toString('utf8')
}

export default decryptIntegrationSecret
