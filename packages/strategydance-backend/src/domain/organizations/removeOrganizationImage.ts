import type { OrganizationImageKind } from 'strategydance-core'

import deleteReplacedOrganizationImage from '~domain/organizations/deleteReplacedOrganizationImage'
import isAdministratorRefusal from '~domain/organizations/isAdministratorRefusal'
import writeOrganizationImageUrl from '~domain/organizations/writeOrganizationImageUrl'

type RemoveOrganizationImageInput = {
  organizationId: string
  userId: string
  kind: OrganizationImageKind
}

type RemoveOrganizationImageResult = { outcome: 'forbidden' } | { outcome: 'removed' }

/*
  Takes an organization's logo or banner away, for one of its administrators: the row first, then
  the files it pointed at, the logo's thumbnail with the logo. Removing a picture that is already
  gone succeeds, since the outcome is the one asked for
*/
async function removeOrganizationImage({
  organizationId,
  userId,
  kind,
}: RemoveOrganizationImageInput): Promise<RemoveOrganizationImageResult> {
  let previousUrls: (string | null)[]

  try {
    previousUrls = await writeOrganizationImageUrl({ organizationId, userId, kind, url: null, thumbnailUrl: null })
  } catch (error) {
    if (isAdministratorRefusal(error)) return { outcome: 'forbidden' }

    throw error
  }

  await Promise.all(previousUrls.map(url => deleteReplacedOrganizationImage({ organizationId, kind, url })))

  return { outcome: 'removed' }
}

export default removeOrganizationImage
