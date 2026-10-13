import { KeyManagementServiceClient } from '@google-cloud/kms'

let client: KeyManagementServiceClient | null = null

/*
  The one Cloud KMS client, on Application Default Credentials, like the Firebase Admin SDK: on
  Cloud Run the service's own account, which holds `roles/cloudkms.cryptoKeyEncrypterDecrypter` on
  the integrations' key alone.

  Made on first use, so development, which encrypts under a local key, never makes it
*/
function getKmsClient() {
  client ??= new KeyManagementServiceClient()

  return client
}

export default getKmsClient
