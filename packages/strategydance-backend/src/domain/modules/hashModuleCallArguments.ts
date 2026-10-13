import { createHash } from 'node:crypto'

import toCanonicalJson from '~utils/toCanonicalJson'

/*
  A call's arguments hashed with SHA-256, in hex, as canonical JSON, so a call a client sends again
  under its idempotency key matches however the client serializes it the second time
*/
function hashModuleCallArguments(args: unknown) {
  return createHash('sha256').update(toCanonicalJson(args)).digest('hex')
}

export default hashModuleCallArguments
