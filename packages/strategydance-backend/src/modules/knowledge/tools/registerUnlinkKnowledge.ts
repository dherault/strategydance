import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { KnowledgeToolContext } from '~types'

import unlinkKnowledge from '~domain/knowledge/unlinkKnowledge'

import { kindSchema, knowledgeIdSchema, linkReferenceShape, linkTargetShape } from '~modules/knowledge/knowledgeSchemas'
import readKnowledgeWriteCall from '~modules/knowledge/readKnowledgeWriteCall'
import toKnowledgeWriteResult from '~modules/knowledge/toKnowledgeWriteResult'

const TOOL = 'unlink_knowledge'

const inputSchema = z.object({
  kind: kindSchema.describe("The item's kind"),
  id: knowledgeIdSchema.describe("The item's id, as list_knowledge gives it"),
  ...linkTargetShape,
})

const outputSchema = z.object({ kind: kindSchema, id: z.string(), isRemoved: z.boolean(), ...linkReferenceShape })

// `unlink_knowledge`: an item unlinked from a document, a task or a member it no longer involves
function registerUnlinkKnowledge(server: McpServer, context: KnowledgeToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Unlink knowledge',
      description:
        'Unlinks an item of the knowledge from a document, a task or a member it no longer involves, named as link_knowledge names them: exactly one of `documentId`, `taskId` and `member`. The document, the task or the member stays as it is. Unlinking what is not linked changes nothing, which `isRemoved` false says. Answers whether a link was removed, with its target.',
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args, serverContext) => {
      const prepared = readKnowledgeWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      return toKnowledgeWriteResult(await unlinkKnowledge(context.caller, args, prepared.call))
    },
  )
}

export default registerUnlinkKnowledge
