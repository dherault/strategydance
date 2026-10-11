import type { AuthInfo } from '@modelcontextprotocol/server'
import { MODULES } from 'strategydance-core'
import { z } from 'zod'

import type { ModuleCaller } from '~types'

const MODULE_SCOPES = MODULES.flatMap(({ scopes }) => [scopes.read, scopes.write])

const callerSchema = z.object({
  kind: z.enum(['agent', 'external']),
  userId: z.string().min(1),
  organizationId: z.string().min(1),
  membershipCreatedAt: z.string().min(1),
  scopes: z.array(z.enum(MODULE_SCOPES)),
  idempotencyScope: z.string().min(1),
})

/*
  The caller a module's server is built for, read back out of the `AuthInfo` that `toModuleAuthInfo`
  wrote. A request that carries none is refused before any server exists: nothing in it may come
  from what the client sent
*/
function readModuleCaller(authInfo: AuthInfo | undefined): ModuleCaller {
  const parsed = callerSchema.safeParse(authInfo?.extra?.caller)

  if (!parsed.success) throw new Error('A module was called without a verified caller')

  return parsed.data
}

export default readModuleCaller
