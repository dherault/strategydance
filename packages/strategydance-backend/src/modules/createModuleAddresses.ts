import type { ReachedModuleOrganization } from '~types'

import { APP_URL } from '~constants'

/*
  The web address of something a module reads and writes, `<app>/<organization>/<section>/<id>`,
  which an external agent's results carry so it can link the member to it: a document under
  `documents`, a task under `tasks`, which opens it in its dialog over the board. The organization is
  written as the app's paths lead with it, the slug, or the id while it has none, as the token's
  verification read it. Strategy Dance's agent links with `doc:` and `task:` instead, so its
  results carry none: it is given no organization here
*/
function createModuleAddresses(
  organization: Pick<ReachedModuleOrganization, 'segment'> | null,
  section: 'documents' | 'tasks' | 'budget',
) {
  return (id: string) =>
    Promise.resolve(organization ? `${APP_URL}/${organization.segment}/${section}/${id}` : undefined)
}

export default createModuleAddresses
