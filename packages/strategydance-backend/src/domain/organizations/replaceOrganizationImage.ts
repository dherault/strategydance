import { randomUUID } from 'node:crypto'
import type { OrganizationImageKind } from 'strategydance-core'

import { STORAGE_DOWNLOAD_ORIGIN } from '~constants'
import { bucket } from '~firebase'

import buildOrganizationStoragePrefix from '~utils/buildOrganizationStoragePrefix'
import buildStorageDownloadUrl from '~utils/buildStorageDownloadUrl'
import logger from '~utils/logger'

import deleteReplacedOrganizationImage from '~domain/organizations/deleteReplacedOrganizationImage'
import isAdministratorRefusal from '~domain/organizations/isAdministratorRefusal'
import writeOrganizationImageUrl from '~domain/organizations/writeOrganizationImageUrl'

type ReplaceOrganizationImageInput = {
  organizationId: string
  userId: string
  kind: OrganizationImageKind
  bytes: Buffer
  // Read off the bytes, never off the request
  contentType: string
}

type ReplaceOrganizationImageResult =
  | { outcome: 'forbidden' }
  | { outcome: 'replaced', url: string }

/*
  Makes a picture an organization's logo or banner, for one of its administrators.

  The file goes to a fresh name under the organization's prefix, with a download token of its own,
  so its URL is new as well: no browser holds an older picture under it, and the row never points
  at a file halfway through being overwritten. Then the row, whose mutation checks the
  administrator again and answers with the URL it replaced, and that URL's file goes last.

  A refused or failed row write deletes the new file, so nothing is left that no row points at
*/
async function replaceOrganizationImage({ organizationId, userId, kind, bytes, contentType }: ReplaceOrganizationImageInput): Promise<ReplaceOrganizationImageResult> {
  const name = `${buildOrganizationStoragePrefix(organizationId, kind)}${randomUUID()}`
  const token = randomUUID()
  const file = bucket.file(name)

  await file.save(bytes, {
    resumable: false,
    contentType,
    metadata: {
      // The name is never reused, so what a browser caches under it never goes stale. Private,
      // so no shared cache keeps serving a picture after it was replaced or its organization
      // deleted
      cacheControl: 'private, max-age=31536000, immutable',
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  })

  const url = buildStorageDownloadUrl({ origin: STORAGE_DOWNLOAD_ORIGIN, bucket: bucket.name, name, token })

  let previousUrl: string | null

  try {
    previousUrl = await writeOrganizationImageUrl({ organizationId, userId, kind, url })
  }
  catch (error) {
    try {
      await file.delete({ ignoreNotFound: true })
    }
    catch (deleteError) {
      logger.error(`Organization images: could not delete ${name} after its row refused it`, deleteError)
    }

    if (isAdministratorRefusal(error)) return { outcome: 'forbidden' }

    throw error
  }

  await deleteReplacedOrganizationImage({ organizationId, kind, url: previousUrl })

  return { outcome: 'replaced', url }
}

export default replaceOrganizationImage
