import { createDecipheriv } from 'node:crypto'

import { DEVELOPMENT_INTEGRATION_KEY, INTEGRATION_KMS_KEY_NAME, IS_PRODUCTION } from '~constants'

import getKmsClient from '~utils/getKmsClient'

import buildIntegrationKeyContext, { type IntegrationKeyOwner } from '~domain/integrations/buildIntegrationKeyContext'

const KMS_PREFIX = 'v1:kms:'

const LOCAL_PREFIX = 'v1:local:'

/*
  The key `encryptIntegrationKey` encrypted for this organization and server. One encrypted for
  another row, or tampered with, fails to open, and so does one encrypted elsewhere than where it is
  read: Cloud KMS's in production alone, the local key's anywhere else
*/
async function decryptIntegrationKey(encrypted: string, owner: IntegrationKeyOwner) {
  const context = buildIntegrationKeyContext(owner)

  if (IS_PRODUCTION) {
    if (!encrypted.startsWith(KMS_PREFIX)) throw new Error('A key not encrypted with Cloud KMS')

    const [response] = await getKmsClient().decrypt({
      name: INTEGRATION_KMS_KEY_NAME,
      ciphertext: Buffer.from(encrypted.slice(KMS_PREFIX.length), 'base64'),
      additionalAuthenticatedData: context,
    })

    if (!response.plaintext) throw new Error('Cloud KMS answered no plaintext')

    return Buffer.from(response.plaintext).toString('utf8')
  }

  if (!encrypted.startsWith(LOCAL_PREFIX)) throw new Error('A key not encrypted with the local key')

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

export default decryptIntegrationKey
