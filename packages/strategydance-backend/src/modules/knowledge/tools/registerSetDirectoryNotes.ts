import type { McpServer } from '@modelcontextprotocol/server'
import { MAX_KNOWLEDGE_NOTE_LENGTH } from 'strategydance-core'
import { z } from 'zod'

import type { KnowledgeToolContext } from '~types'

import setDirectoryNotes from '~domain/knowledge/setDirectoryNotes'

import { knowledgeIdSchema } from '~modules/knowledge/knowledgeSchemas'
import readKnowledgeWriteCall from '~modules/knowledge/readKnowledgeWriteCall'
import toKnowledgeWriteResult from '~modules/knowledge/toKnowledgeWriteResult'
import { hasNoNul } from '~modules/moduleSchemas'

const TOOL = 'set_directory_notes'

const inputSchema = z.object({
  id: knowledgeIdSchema.describe("The directory's id, as list_knowledge gives it"),
  notes: z
    .string()
    .max(MAX_KNOWLEDGE_NOTE_LENGTH * 2)
    .refine(hasNoNul, 'Notes hold no U+0000')
    .describe('The whole notes replaced, in Markdown, "" clearing them'),
  version: z.string().max(200).describe("The notesVersion read_knowledge gave for the directory's notes"),
})

const outputSchema = z.object({ id: z.string(), notesVersion: z.string() })

// `set_directory_notes`: a directory's notes replaced, as the agent read them
function registerSetDirectoryNotes(server: McpServer, context: KnowledgeToolContext) {
  server.registerTool(
    TOOL,
    {
      title: "Write a directory's notes",
      description:
        'Replaces the team\'s notes on a directory of the knowledge, which its page shows beside its status: what the member sent, the logins they chose, the replies that came back and what to follow up. `notes` replaces the whole of them, in Markdown, headings, lists, checklists, quotes, code and tables, `""` clearing them, so keep what they held that still holds. It takes the `notesVersion` read_knowledge gave, and is refused when someone changed the notes since: read the directory again first. Notes that the directory holds already change nothing. Answers the notes\' new version.',
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args, serverContext) => {
      const prepared = readKnowledgeWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      return toKnowledgeWriteResult(await setDirectoryNotes(context.caller, args, prepared.call))
    },
  )
}

export default registerSetDirectoryNotes
