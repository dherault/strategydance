import type { OrganizationImageKind } from 'strategydance-core'

import deleteReplacedOrganizationImage from '~domain/organizations/deleteReplacedOrganizationImage'
import isAdministratorRefusal from '~domain/organizations/isAdministratorRefusal'
import writeOrganizationImageUrl from '~domain/organizations/writeOrganizationImageUrl'

type RemoveOrganizationImageInput = {
  organizationId: string
  userId: string
  kind: OrganizationImageKind
}

type RemoveOrganizationImageResult =
  | { outcome: 'forbidden' }
  | { outcome: 'removed' }

/*
  Takes an organization's logo or banner away, for one of its administrators: the row first, then
  the file it pointed at. Removing a picture that is already gone succeeds, since the outcome is
  the one asked for
*/
async function removeOrganizationImage({ organizationId, userId, kind }: RemoveOrganizationImageInput): Promise<RemoveOrganizationImageResult> {
  let previousUrl: string | null

  try {
    previousUrl = await writeOrganizationImageUrl({ organizationId, userId, kind, url: null })
  }
  catch (error) {
    if (isAdministratorRefusal(error)) return { outcome: 'forbidden' }

    throw error
  }

  await deleteReplacedOrganizationImage({ organizationId, kind, url: previousUrl })

  return { outcome: 'removed' }
}

export default removeOrganizationImage
