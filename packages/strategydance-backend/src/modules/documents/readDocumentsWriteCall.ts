import type { ServerContext } from '@modelcontextprotocol/server'

import type { DocumentsToolContext } from '~types'

import documentsModule from '~modules/documents/documentsModule'
import toDocumentsRefusal from '~modules/documents/toDocumentsRefusal'
import readModuleWriteCall from '~modules/readModuleWriteCall'

// What every write tool of the Documents module checks before anything is read or written: the write
// scope, and the idempotency key its call carries, if any
function readDocumentsWriteCall(
  context: DocumentsToolContext,
  serverContext: ServerContext,
  tool: string,
  args: unknown,
) {
  return readModuleWriteCall(
    context.caller,
    { scope: documentsModule.scopes.write, readOnly: toDocumentsRefusal({ outcome: 'readOnly' }) },
    serverContext,
    tool,
    args,
  )
}

export default readDocumentsWriteCall
