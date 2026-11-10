import type { ReachedModuleOrganization } from '~types'

import joinInWords from '~utils/joinInWords'

/*
  The organizations an external agent's connection reaches, as a sentence lists them: each by what
  a call names it, then its name, both quoted, since an administrator wrote the name, so it stays
  data the model reads, never words of the sentence. Joined with "and", or "or" for a choice
*/
function listModuleOrganizations(organizations: readonly ReachedModuleOrganization[], conjunction: 'and' | 'or') {
  return joinInWords(
    organizations.map(({ segment, name }) => `${JSON.stringify(segment)} (${JSON.stringify(name)})`),
    conjunction,
  )
}

export default listModuleOrganizations
