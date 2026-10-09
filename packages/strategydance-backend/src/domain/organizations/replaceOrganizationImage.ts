import { randomUUID } from 'node:crypto'

import type { OrganizationImageKind } from 'strategydance-core'

import { STORAGE_DOWNLOAD_ORIGIN } from '~constants'

import { bucket } from '~firebase'

import buildOrganizationStoragePrefix from '~utils/buildOrganizationStoragePrefix'
import buildStorageDownloadUrl from '~utils/buildStorageDownloadUrl'
import logger from '~utils/logger'
import type { ImageFile } from '~utils/readImageUpload'

import deleteReplacedOrganizationImage from '~domain/organizations/deleteReplacedOrganizationImage'
import isAdministratorRefusal from '~domain/organizations/isAdministratorRefusal'
import writeOrganizationImageUrl from '~domain/organizations/writeOrganizationImageUrl'

type ReplaceOrganizationImageInput = {
  organizationId: string
  userId: string
  kind: OrganizationImageKind
  image: ImageFile
  // The logo's, drawn small by the page. Null for a banner, and for a logo sent without one
  thumbnail: ImageFile | null
}

type ReplaceOrganizationImageResult = { outcome: 'forbidden' } | { outcome: 'replaced'; url: string }

// A fresh name in the organization's folder for that kind of picture
function createImageFileName(organizationId: string, kind: OrganizationImageKind) {
  return `${buildOrganizationStoragePrefix(organizationId, kind)}${randomUUID()}`
}

// Saves a file under a name, with a download token of its own, and answers with its URL
async function saveImageFile(name: string, { bytes, contentType }: ImageFile) {
  const token = randomUUID()

  await bucket.file(name).save(bytes, {
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

  return buildStorageDownloadUrl({ origin: STORAGE_DOWNLOAD_ORIGIN, bucket: bucket.name, name, token })
}

/*
  Makes a picture an organization's logo or banner, for one of its administrators, with the logo's
  thumbnail beside it.

  Each file goes to a fresh name under the organization's prefix, with a download token of its own,
  so its URL is new as well: no browser holds an older picture under it, and the row never points
  at a file halfway through being overwritten. Then the row, whose mutation checks the
  administrator again and answers with the URLs it replaced, and those URLs' files go last. A logo
  sent without a thumbnail clears the previous one's, which the page then draws the logo in place
  of.

  A refused or failed row write, or a file that fails to save, deletes the new files, so nothing is
  left that no row points at. Their names are drawn before either is sent, so a save that failed
  only on the way back, the file stored and its answer lost, is deleted too
*/
async function replaceOrganizationImage({
  organizationId,
  userId,
  kind,
  image,
  thumbnail,
}: ReplaceOrganizationImageInput): Promise<ReplaceOrganizationImageResult> {
  const name = createImageFileName(organizationId, kind)
  const thumbnailName = thumbnail ? createImageFileName(organizationId, kind) : null
  let url: string
  let previousUrls: (string | null)[]

  try {
    url = await saveImageFile(name, image)

    const thumbnailUrl = thumbnail && thumbnailName ? await saveImageFile(thumbnailName, thumbnail) : null

    previousUrls = await writeOrganizationImageUrl({ organizationId, userId, kind, url, thumbnailUrl })
  } catch (error) {
    // A name never saved is not found, which the delete ignores
    await Promise.all(
      [name, thumbnailName]
        .filter(fileName => fileName !== null)
        .map(async fileName => {
          try {
            await bucket.file(fileName).delete({ ignoreNotFound: true })
          } catch (deleteError) {
            logger.error(`Organization images: could not delete ${fileName} after its upload failed`, deleteError)
          }
        }),
    )

    if (isAdministratorRefusal(error)) return { outcome: 'forbidden' }

    throw error
  }

  await Promise.all(
    previousUrls.map(previousUrl => deleteReplacedOrganizationImage({ organizationId, kind, url: previousUrl })),
  )

  return { outcome: 'replaced', url }
}

export default replaceOrganizationImage
