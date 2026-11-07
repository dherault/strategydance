import type { ModuleAccess, ModuleCaller, ModuleOrganization } from '~types'

// The caller a call acts as, in one of the organizations its access reaches, with the run calling
// for Strategy Dance's agent, which alone has one
function toModuleCaller(
  access: ModuleAccess,
  { organizationId, membershipCreatedAt }: ModuleOrganization,
): ModuleCaller {
  return {
    kind: access.kind,
    userId: access.userId,
    organizationId,
    membershipCreatedAt,
    scopes: access.scopes,
    idempotencyScope: access.idempotencyScope,
    ...(access.kind === 'agent' && access.launcher && { launcher: access.launcher }),
  }
}

export default toModuleCaller
