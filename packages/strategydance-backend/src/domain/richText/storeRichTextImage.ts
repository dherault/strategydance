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
  without a membership the file goes and the upload is refused. A read that fails takes the file
  away too, as the upload fails and a retry saves another.

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

  // Deletes the file this upload saved, logging rather than throwing when that fails too
  async function discard(reason: string) {
    try {
      await file.delete({ ignoreNotFound: true })
    } catch (error) {
      logger.error(`Rich text images: could not delete ${name}, ${reason}`, error)
    }
  }

  let isMember: boolean

  try {
    const { data } = await getOrganizationMembership(dataConnect, { organizationId, userId })

    isMember = !!data.userOrganization
  } catch (error) {
    // The upload fails, and a retry saves another file, so this one goes
    await discard('stored by an upload whose membership could not be read')

    throw error
  }

  if (!isMember) {
    await discard('stored for an organization the uploader left')

    return { outcome: 'forbidden' }
  }

  return {
    outcome: 'stored',
    url: buildStorageDownloadUrl({ origin: STORAGE_DOWNLOAD_ORIGIN, bucket: bucket.name, name, token }),
  }
}

export default storeRichTextImage
