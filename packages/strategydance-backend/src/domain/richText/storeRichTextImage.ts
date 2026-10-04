import { randomUUID } from 'node:crypto'

import { STORAGE_DOWNLOAD_ORIGIN } from '~constants'

import { bucket } from '~firebase'

import buildOrganizationStoragePrefix from '~utils/buildOrganizationStoragePrefix'
import buildStorageDownloadUrl from '~utils/buildStorageDownloadUrl'

type StoreRichTextImageInput = {
  organizationId: string
  bytes: Buffer
  // Read off the bytes, never off the request
  contentType: string
}

/*
  Stores a picture a member put in one of the organization's documents, and answers with the URL
  the document's text keeps. It goes to a fresh name under the organization's `rich-text/` folder,
  with a download token of its own, so deleting the organization sweeps it with the rest.

  Nothing ever deletes it before then. The text points at it by its URL alone, an undo or another
  writer's tab can bring a deleted picture back, and the same URL can be pasted into another
  document, so no moment says it is unused
*/
async function storeRichTextImage({ organizationId, bytes, contentType }: StoreRichTextImageInput) {
  const name = `${buildOrganizationStoragePrefix(organizationId, 'rich-text')}${randomUUID()}`
  const token = randomUUID()

  await bucket.file(name).save(bytes, {
    resumable: false,
    contentType,
    metadata: {
      // The name is never reused, so what a browser caches under it never goes stale. Private, so
      // no shared cache keeps serving it once its organization is deleted
      cacheControl: 'private, max-age=31536000, immutable',
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  })

  return buildStorageDownloadUrl({ origin: STORAGE_DOWNLOAD_ORIGIN, bucket: bucket.name, name, token })
}

export default storeRichTextImage
