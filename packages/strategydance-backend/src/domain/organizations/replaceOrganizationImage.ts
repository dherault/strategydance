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

/*
  Saves a file under a fresh name in the organization's folder for that kind of picture, with a
  download token of its own, and answers with its name and URL
*/
async function saveImageFile(organizationId: string, kind: OrganizationImageKind, { bytes, contentType }: ImageFile) {
  const name = `${buildOrganizationStoragePrefix(organizationId, kind)}${randomUUID()}`
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

  return { name, url: buildStorageDownloadUrl({ origin: STORAGE_DOWNLOAD_ORIGIN, bucket: bucket.name, name, token }) }
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

  A refused or failed row write, or a thumbnail that fails to save, deletes the new files, so
  nothing is left that no row points at
*/
async function replaceOrganizationImage({
  organizationId,
  userId,
  kind,
  image,
  thumbnail,
}: ReplaceOrganizationImageInput): Promise<ReplaceOrganizationImageResult> {
  const savedNames: string[] = []
  let url: string
  let previousUrls: (string | null)[]

  try {
    const saved = await saveImageFile(organizationId, kind, image)

    savedNames.push(saved.name)
    url = saved.url

    const savedThumbnail = thumbnail ? await saveImageFile(organizationId, kind, thumbnail) : null

    if (savedThumbnail) savedNames.push(savedThumbnail.name)

    previousUrls = await writeOrganizationImageUrl({
      organizationId,
      userId,
      kind,
      url,
      thumbnailUrl: savedThumbnail?.url ?? null,
    })
  } catch (error) {
    await Promise.all(
      savedNames.map(async name => {
        try {
          await bucket.file(name).delete({ ignoreNotFound: true })
        } catch (deleteError) {
          logger.error(`Organization images: could not delete ${name} after its upload failed`, deleteError)
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
