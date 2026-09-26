import type { OrganizationImageKind } from 'strategydance-core'
import { updateOrganizationBanner, updateOrganizationLogo } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

type WriteOrganizationImageUrlInput = {
  organizationId: string
  userId: string
  kind: OrganizationImageKind
  // Null clears the picture
  url: string | null
}

/*
  Points an organization's logo or banner at a URL, or clears it, and answers with the URL it
  replaced. Two mutations behind one call, since a mutation names the column it writes
*/
async function writeOrganizationImageUrl({ organizationId, userId, kind, url }: WriteOrganizationImageUrlInput) {
  if (kind === 'logo') {
    const { data } = await updateOrganizationLogo(dataConnect, { organizationId, userId, logoUrl: url })

    return data.previous?.organization?.logoUrl ?? null
  }

  const { data } = await updateOrganizationBanner(dataConnect, { organizationId, userId, bannerUrl: url })

  return data.previous?.organization?.bannerUrl ?? null
}

export default writeOrganizationImageUrl
