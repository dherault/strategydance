import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { KnowledgeToolContext } from '~types'

import { MAX_KNOWLEDGE_LINKS } from '~constants'

import linkKnowledge from '~domain/knowledge/linkKnowledge'

import { kindSchema, knowledgeIdSchema, linkReferenceShape, linkTargetShape } from '~modules/knowledge/knowledgeSchemas'
import readKnowledgeWriteCall from '~modules/knowledge/readKnowledgeWriteCall'
import toKnowledgeWriteResult from '~modules/knowledge/toKnowledgeWriteResult'

const TOOL = 'link_knowledge'

const inputSchema = z.object({
  kind: kindSchema.describe("The item's kind"),
  id: knowledgeIdSchema.describe("The item's id, as list_knowledge gives it"),
  ...linkTargetShape,
})

const outputSchema = z.object({ kind: kindSchema, id: z.string(), isNew: z.boolean(), ...linkReferenceShape })

// `link_knowledge`: an item linked to a document, a task or a member it involves
function registerLinkKnowledge(server: McpServer, context: KnowledgeToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Link knowledge',
      description: `Links an item of the knowledge to a document, a task or a member of the organization it involves: the document a framework was applied in, the tasks that carry a tactic out and the member who runs it, the task that tracks a directory's submission. Name exactly one of \`documentId\`, \`taskId\` and \`member\`. Only a document the team lets AI read, and a task not deleted, can be linked. An item need not be in use to be linked, and links up to ${MAX_KNOWLEDGE_LINKS} documents, ${MAX_KNOWLEDGE_LINKS} tasks and ${MAX_KNOWLEDGE_LINKS} members, while a document, a task or a member can be linked to any number of items. A link there already changes nothing, which \`isNew\` false says. Answers the link with its target's title or name.`,
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args, serverContext) => {
      const prepared = readKnowledgeWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      return toKnowledgeWriteResult(await linkKnowledge(context.caller, args, prepared.call))
    },
  )
}

export default registerLinkKnowledge
