import type { OrganizationImageKind } from 'strategydance-core'
import { updateOrganizationBanner, updateOrganizationLogo } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

type WriteOrganizationImageUrlInput = {
  organizationId: string
  userId: string
  kind: OrganizationImageKind
  // Null clears the picture
  url: string | null
  // The logo's thumbnail, null for none. A banner has no thumbnail, and this is never one
  thumbnailUrl: string | null
}

/*
  Points an organization's logo or banner at a URL, or clears it, and answers with every URL it
  replaced, the logo's thumbnail's among them, null for none. Two mutations behind one call, since
  a mutation names the columns it writes
*/
async function writeOrganizationImageUrl({
  organizationId,
  userId,
  kind,
  url,
  thumbnailUrl,
}: WriteOrganizationImageUrlInput) {
  if (kind === 'logo') {
    const { data } = await updateOrganizationLogo(dataConnect, {
      organizationId,
      userId,
      logoUrl: url,
      logoThumbnailUrl: thumbnailUrl,
    })

    return [data.previous?.organization?.logoUrl ?? null, data.previous?.organization?.logoThumbnailUrl ?? null]
  }

  const { data } = await updateOrganizationBanner(dataConnect, { organizationId, userId, bannerUrl: url })

  return [data.previous?.organization?.bannerUrl ?? null]
}

export default writeOrganizationImageUrl
