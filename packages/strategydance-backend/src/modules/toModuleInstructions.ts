import type { ModuleAccess } from '~types'

import listModuleOrganizations from '~modules/listModuleOrganizations'

/*
  What a module's server tells an agent before it calls anything, for the access it is built for:
  the module's own instructions, and for an external agent, the organizations its connection
  reaches, which every tool takes as `organization`. Strategy Dance's agent acts in its run's
  organization alone, so it is told nothing more
*/
function toModuleInstructions(instructions: string, access: ModuleAccess) {
  if (access.kind === 'agent') return instructions

  const { organizations } = access

  if (organizations.length === 1) {
    return `${instructions}

This connection reaches one of the member's organizations, ${listModuleOrganizations(organizations, 'and')}, which every tool takes as organization.`
  }

  return `${instructions}

This connection reaches ${organizations.length} of the member's organizations, ${listModuleOrganizations(organizations, 'and')}, and every tool takes the one its call acts in as organization. Each id belongs to one organization: name the one it came from. When the member has not said which organization they mean, ask them rather than choose.`
}

export default toModuleInstructions
