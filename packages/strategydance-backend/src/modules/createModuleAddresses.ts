import { toOrganizationPathSegment } from 'strategydance-core'
import { getOrganizationForAgent } from 'strategydance-database/backend'

import type { ModuleCaller } from '~types'

import { APP_URL } from '~constants'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

/*
  The web address of something a module reads and writes, `<app>/<organization>/<section>/<id>`,
  which an external agent's results carry so it can link the member to it: a document under
  `knowledge`, a task under `tasks`, which opens it in its dialog over the board. The organization is
  written as the app's paths lead with it, the slug, or the id while it has none, and read once for
  the server, which lives one request. Strategy Dance's agent links with `doc:` and `task:` instead,
  so its results carry none. An organization that cannot be read gives no address rather than an
  error: a write's answer reads its address once the write is done, and failing it there would
  answer a write that went through as one that did not
*/
function createModuleAddresses(caller: ModuleCaller, section: 'knowledge' | 'tasks' | 'budget') {
  let segment: Promise<string | null> | null = null

  return async (id: string) => {
    if (caller.kind !== 'external') return undefined

    segment ??= getOrganizationForAgent(dataConnect, { organizationId: caller.organizationId })
      .then(({ data }) => toOrganizationPathSegment(data.organization ?? { id: caller.organizationId }))
      .catch((error: unknown) => {
        logger.warn(`Module addresses: organization ${caller.organizationId} could not be read`, error)

        return null
      })

    const read = await segment

    return read === null ? undefined : `${APP_URL}/${read}/${section}/${id}`
  }
}

export default createModuleAddresses
