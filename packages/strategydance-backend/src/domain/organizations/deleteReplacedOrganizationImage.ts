import type { OrganizationImageKind } from 'strategydance-core'

import { bucket } from '~firebase'

import buildOrganizationStoragePrefix from '~utils/buildOrganizationStoragePrefix'
import logger from '~utils/logger'
import parseStorageObjectName from '~utils/parseStorageObjectName'

type DeleteReplacedOrganizationImageInput = {
  organizationId: string
  kind: OrganizationImageKind
  // What the row pointed at before, as its mutation answered. Null when there was nothing
  url: string | null
}

/*
  Deletes the file a picture's old URL pointed at, once the row no longer does.

  Only a file under the organization's own prefix for that kind: the URL came out of the database,
  and a row pointing anywhere else, by a bug or by hand, must not turn into a delete there. Best
  effort, since the row is already right by now: a file left behind costs storage rather than
  correctness, and is logged
*/
async function deleteReplacedOrganizationImage({ organizationId, kind, url }: DeleteReplacedOrganizationImageInput) {
  if (!url) return

  const name = parseStorageObjectName(url, bucket.name)

  if (!name?.startsWith(buildOrganizationStoragePrefix(organizationId, kind))) {
    logger.warn(`Organization images: left ${url} in place, since it is not one of ${organizationId}'s ${kind} files`)

    return
  }

  try {
    await bucket.file(name).delete({ ignoreNotFound: true })
  }
  catch (error) {
    logger.error(`Organization images: could not delete ${name}, which nothing points at any more`, error)
  }
}

export default deleteReplacedOrganizationImage
