import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { DocumentsToolContext } from '~types'

import deleteDocument from '~domain/documents/deleteDocument'

import documentsModule from '~modules/documents/documentsModule'
import { documentIdSchema } from '~modules/documents/documentsSchemas'
import readDocumentsWriteCall from '~modules/documents/readDocumentsWriteCall'
import toDocumentsRefusal from '~modules/documents/toDocumentsRefusal'
import toDocumentsWriteResult from '~modules/documents/toDocumentsWriteResult'
import requireModuleWriteScope from '~modules/requireModuleWriteScope'

const TOOL = 'delete_document'

const inputSchema = z.object({ id: documentIdSchema })

const outputSchema = z.object({
  id: z.string(),
  restorableUntil: z.string(),
})

// `delete_document`: a document deleted as its page's Delete does, restorable for a day
function registerDeleteDocument(server: McpServer, context: DocumentsToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Delete a document',
      description:
        "Deletes a document of the organization, as its page's Delete does. It can be restored with restore_document for a day, until `restorableUntil`, then it is gone for good. Call it only when the member asks for the document to go.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      scopeChallenge: requireModuleWriteScope(documentsModule),
    },
    async (args, serverContext) => {
      const prepared = readDocumentsWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      // A reaction to subagents' reports deletes nothing: the member's answer starts the run that may.
      // Read only for a call from a run, whose read loads the conversation runtime
      if (context.caller.launcher) {
        const { default: isReactionCaller } = await import('~domain/subagents/isReactionCaller')

        if (await isReactionCaller(context.caller)) return toDocumentsRefusal({ outcome: 'fromReaction' })
      }

      // A deleted document's page shows nothing, so the answer carries no address
      return toDocumentsWriteResult(await deleteDocument(context.caller, args, prepared.call), null)
    },
  )
}

export default registerDeleteDocument
