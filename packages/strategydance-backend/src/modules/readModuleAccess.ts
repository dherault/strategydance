import type { AuthInfo } from '@modelcontextprotocol/server'
import { MAX_AGENT_CONNECTION_ORGANIZATIONS, MODULES } from 'strategydance-core'
import { z } from 'zod'

import type { ModuleAccess } from '~types'

const MODULE_SCOPES = MODULES.flatMap(({ scopes }) => [scopes.read, scopes.write])

const organizationShape = {
  organizationId: z.string().min(1),
  membershipCreatedAt: z.string().min(1),
}

const commonShape = {
  userId: z.string().min(1),
  scopes: z.array(z.enum(MODULE_SCOPES)),
  idempotencyScope: z.string().min(1),
}

const accessSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('agent'),
    ...commonShape,
    launcher: z.strictObject({ conversationId: z.string().min(1), runId: z.string().min(1) }).optional(),
    organization: z.strictObject(organizationShape),
  }),
  z.strictObject({
    kind: z.literal('external'),
    ...commonShape,
    connectionScopes: z.array(z.enum(MODULE_SCOPES)),
    organizations: z
      .array(z.strictObject({ ...organizationShape, segment: z.string().min(1), name: z.string() }))
      .min(1)
      .max(MAX_AGENT_CONNECTION_ORGANIZATIONS),
  }),
])

/*
  The access a module's server is built for, read back out of the `AuthInfo` that `toModuleAuthInfo`
  wrote. A request that carries none is refused before any server exists: nothing in it may come
  from what the client sent. Strict, so a field it does not know is refused rather than dropped
*/
function readModuleAccess(authInfo: AuthInfo | undefined): ModuleAccess {
  const parsed = accessSchema.safeParse(authInfo?.extra?.access)

  if (!parsed.success) throw new Error('A module was called without a verified access')

  return parsed.data
}

export default readModuleAccess
