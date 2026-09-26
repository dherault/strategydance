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
  Deletes an organization, for one of its administrators: the row, which takes its memberships and
  invitations with it, then every file under its prefix.

  The row goes first. Were the files first, a row write that failed would leave an organization
  whose pictures are gone; this way a sweep that fails leaves files nothing points at, which cost
  storage rather than correctness and are logged
*/
async function deleteOrganization({ organizationId, userId }: DeleteOrganizationInput): Promise<DeleteOrganizationResult> {
  try {
    await deleteOrganizationMutation(dataConnect, { organizationId, userId })
  }
  catch (error) {
    if (isAdministratorRefusal(error)) return { outcome: 'forbidden' }

    throw error
  }

  const prefix = buildOrganizationStoragePrefix(organizationId)

  try {
    // `force` carries on past a file that fails, so one cannot keep the rest
    await bucket.deleteFiles({ prefix, force: true })
  }
  catch (error) {
    logger.error(`Organizations: deleted ${organizationId}, but not all of its files under ${prefix}`, error)
  }

  return { outcome: 'deleted' }
}

export default deleteOrganization
