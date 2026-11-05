import type { ModuleAccess, ModuleCaller } from '~types'

/*
  The access a module's tests build a server for, from the one caller they act as: Strategy Dance's
  agent in its organization, or an external agent whose connection reaches that one organization,
  named by its id unless the test gives the slug its token's verification would read, and by the
  name the module's fake gives an organization
*/
function toTestModuleAccess(
  { kind, userId, organizationId, membershipCreatedAt, scopes, idempotencyScope, launcher }: ModuleCaller,
  { segment = organizationId, name = 'Checked organization' }: { segment?: string; name?: string } = {},
): ModuleAccess {
  if (kind === 'agent') {
    return {
      kind,
      userId,
      scopes,
      idempotencyScope,
      ...(launcher && { launcher }),
      organization: { organizationId, membershipCreatedAt },
    }
  }

  return {
    kind,
    userId,
    scopes,
    idempotencyScope,
    organizations: [{ organizationId, membershipCreatedAt, segment, name }],
  }
}

export default toTestModuleAccess
