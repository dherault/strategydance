import { randomUUID } from 'node:crypto'

import { getOrganizationMembership } from 'strategydance-database/backend'

import { STORAGE_DOWNLOAD_ORIGIN } from '~constants'

import { bucket, dataConnect } from '~firebase'

import buildOrganizationStoragePrefix from '~utils/buildOrganizationStoragePrefix'
import buildStorageDownloadUrl from '~utils/buildStorageDownloadUrl'
import logger from '~utils/logger'

type StoreRichTextImageInput = {
  organizationId: string
  userId: string
  bytes: Buffer
  // Read off the bytes, never off the request
  contentType: string
}

type StoreRichTextImageResult = { outcome: 'forbidden' } | { outcome: 'stored'; url: string }

/*
  Stores a picture a member put in one of the organization's documents, and answers with the URL
  the document's text keeps. It goes to a fresh name under the organization's `rich-text/` folder,
  with a download token of its own, so deleting the organization sweeps it with the rest.

  The membership the route checked is read again once the file is saved: an organization deleted
  while the picture went up has swept its files already, and would leave this one behind, so
  without a membership the file goes and the upload is refused.

  Nothing else deletes it before its organization goes. The text points at it by its URL alone,
  an undo or another writer's tab can bring a deleted picture back, and the same URL can be pasted
  into another document, so no moment says it is unused
*/
async function storeRichTextImage({
  organizationId,
  userId,
  bytes,
  contentType,
}: StoreRichTextImageInput): Promise<StoreRichTextImageResult> {
  const name = `${buildOrganizationStoragePrefix(organizationId, 'rich-text')}${randomUUID()}`
  const token = randomUUID()
  const file = bucket.file(name)

  await file.save(bytes, {
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

  const { data } = await getOrganizationMembership(dataConnect, { organizationId, userId })

  if (!data.userOrganization) {
    try {
      await file.delete({ ignoreNotFound: true })
    } catch (error) {
      logger.error(`Rich text images: could not delete ${name}, stored for an organization the uploader left`, error)
    }

    return { outcome: 'forbidden' }
  }

  return {
    outcome: 'stored',
    url: buildStorageDownloadUrl({ origin: STORAGE_DOWNLOAD_ORIGIN, bucket: bucket.name, name, token }),
  }
}

export default storeRichTextImage
