import type { ModuleAccess } from '~types'

import toModuleCaller from '~modules/toModuleCaller'

/*
  The caller of a module whose tools name no organization, Knowledge and Subagents, which no public
  endpoint serves: Strategy Dance's agent, in its run's organization, or an access reaching exactly
  one, as the stdio script's for Knowledge does. One reaching several is refused before any server
  exists, since nothing would say which organization a call acts in
*/
function toSingleModuleCaller(access: ModuleAccess) {
  if (access.kind === 'agent') return toModuleCaller(access, access.organization)

  const [organization, ...others] = access.organizations

  if (!organization || others.length) throw new Error('This module acts in exactly one organization')

  return toModuleCaller(access, organization)
}

export default toSingleModuleCaller
