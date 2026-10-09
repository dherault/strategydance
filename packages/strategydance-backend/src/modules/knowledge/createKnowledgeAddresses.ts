import { toOrganizationPathSegment } from 'strategydance-core'
import { getOrganizationForAgent } from 'strategydance-database/backend'

import type { ModuleCaller } from '~types'

import { APP_URL } from '~constants'

import { dataConnect } from '~firebase'

/*
  The web address of a document, `<app>/<organization>/knowledge/<id>`, which an external agent's
  results carry so it can link the member to it, its organization written as the app's paths lead
  with it: the slug, or the id while it has none. The organization is read once for the server,
  which lives one request. Strategy Dance's agent links documents with `doc:` instead, so its
  results carry none
*/
function createKnowledgeAddresses(caller: ModuleCaller) {
  let segment: Promise<string> | null = null

  return async (documentId: string) => {
    if (caller.kind !== 'external') return undefined

    segment ??= getOrganizationForAgent(dataConnect, { organizationId: caller.organizationId }).then(({ data }) =>
      toOrganizationPathSegment(data.organization ?? { id: caller.organizationId }),
    )

    return `${APP_URL}/${await segment}/knowledge/${documentId}`
  }
}

export default createKnowledgeAddresses
