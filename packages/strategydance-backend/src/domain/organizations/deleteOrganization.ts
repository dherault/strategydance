import { deleteOrganization as deleteOrganizationMutation } from 'strategydance-database/backend'

import { bucket, dataConnect } from '~firebase'

import buildOrganizationStoragePrefix from '~utils/buildOrganizationStoragePrefix'
import logger from '~utils/logger'

import isAdministratorRefusal from '~domain/organizations/isAdministratorRefusal'

type DeleteOrganizationInput = {
  organizationId: string
  userId: string
}

type DeleteOrganizationResult =
  | { outcome: 'forbidden' }
  | { outcome: 'deleted' }

/*
  Deletes an organization, for one of its administrators: every file under its prefix, then the
  row, which takes its memberships and invitations with it, then the prefix once more.

  The files go first, because a download URL outlives any rule: a file left behind after the row
  would stay readable by whoever held its URL, and nobody could ask again, the route being for
  administrators of an organization that no longer exists. So a sweep that fails fails the whole
  request, with the organization still there to delete again.

  The second sweep is for an upload that raced the delete. Admitted before it, an upload can save
  its file after the first sweep and point the row at it before the row goes: swept after the row,
  that file goes too, and an upload that writes any later finds no row and deletes its own. With
  the row gone the route cannot run again, so a failure here is logged with the prefix for somebody
  to clear, and the organization reads as deleted, which it is.

  The price is a row write that fails after the sweep, which leaves the organization without its
  pictures. That takes an outage, or its administrator being demoted in the instant between the
  route's check and the mutation's, and the mark and the banner fall back to their empty looks
*/
async function deleteOrganization({ organizationId, userId }: DeleteOrganizationInput): Promise<DeleteOrganizationResult> {
  const prefix = buildOrganizationStoragePrefix(organizationId)

  // `force` carries on past a file that fails, so one cannot keep the rest, and throws after
  await bucket.deleteFiles({ prefix, force: true })

  try {
    await deleteOrganizationMutation(dataConnect, { organizationId, userId })
  }
  catch (error) {
    if (isAdministratorRefusal(error)) return { outcome: 'forbidden' }

    throw error
  }

  // Finds nothing unless an upload raced the delete
  try {
    await bucket.deleteFiles({ prefix, force: true })
  }
  catch (error) {
    logger.error(`Organization deletion: could not sweep ${prefix} again after deleting its row`, error)
  }

  return { outcome: 'deleted' }
}

export default deleteOrganization
