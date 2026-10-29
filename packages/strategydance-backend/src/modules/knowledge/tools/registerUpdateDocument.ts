import type { McpServer } from '@modelcontextprotocol/server'
import { MAX_DOCUMENT_CONTENT_LENGTH } from 'strategydance-core'
import { z } from 'zod'

import type { DocumentEdit, DocumentsToolContext } from '~types'

import updateDocument from '~domain/documents/updateDocument'

import knowledgeModule from '~modules/knowledge/knowledgeModule'
import { documentIdSchema, markdownSchema, titleSchema } from '~modules/knowledge/knowledgeSchemas'
import readKnowledgeWriteCall from '~modules/knowledge/readKnowledgeWriteCall'
import toKnowledgeWriteResult from '~modules/knowledge/toKnowledgeWriteResult'
import { hasNoNul } from '~modules/moduleSchemas'
import requireModuleWriteScope from '~modules/requireModuleWriteScope'

const TOOL = 'update_document'

// The four ways of editing a document's text, at most one of which a call makes
const EDITS = ['content', 'append', 'replaceBlocks', 'replaceText'] as const

const blockIdSchema = z.string().min(1).max(200)

const inputSchema = z
  .object({
    id: documentIdSchema,
    version: z.string().max(200).optional().describe('The version read_document gave, required with `content`'),
    title: titleSchema.optional().describe('A new title, one line'),
    content: markdownSchema.optional().describe('The whole text replaced, in Markdown'),
    append: markdownSchema.optional().describe('Markdown added after the last block'),
    replaceBlocks: z
      .object({
        fromId: blockIdSchema.describe('The id of the first block replaced'),
        toId: blockIdSchema.describe('The id of the last block replaced, the same as fromId for one block'),
        content: markdownSchema.describe('The Markdown written in their place'),
      })
      .optional(),
    replaceText: z
      .object({
        find: z
          .string()
          .min(1)
          .max(MAX_DOCUMENT_CONTENT_LENGTH)
          .refine(hasNoNul)
          .describe('Text that occurs exactly once'),
        replace: z.string().max(MAX_DOCUMENT_CONTENT_LENGTH).refine(hasNoNul).describe('The text written in its place'),
      })
      .optional(),
  })
  .superRefine((args, context) => {
    const edits = EDITS.filter(edit => args[edit] !== undefined)

    if (edits.length > 1) {
      context.addIssue({ code: 'custom', message: `Make one edit a call: ${edits.join(' and ')} cannot go together` })
    }

    if (edits.length === 0 && args.title === undefined) {
      context.addIssue({ code: 'custom', message: `Send a title or one of ${EDITS.join(', ')}` })
    }
  })

const outputSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  version: z.string().optional(),
  url: z.string().optional(),
})

// The edit a call makes of a document's text, if it makes one
function toEdit({
  content,
  append,
  replaceBlocks,
  replaceText,
}: z.infer<typeof inputSchema>): DocumentEdit | undefined {
  if (content !== undefined) return { type: 'content', markdown: content }
  if (append !== undefined) return { type: 'append', markdown: append }
  if (replaceBlocks)
    return {
      type: 'replaceBlocks',
      fromId: replaceBlocks.fromId,
      toId: replaceBlocks.toId,
      markdown: replaceBlocks.content,
    }
  if (replaceText) return { type: 'replaceText', find: replaceText.find, replace: replaceText.replace }

  return undefined
}

// `update_document`: a document's title, or an edit of its shared text, or both
function registerUpdateDocument(server: McpServer, context: DocumentsToolContext) {
  server.registerTool(
    TOOL,
    {
      title: 'Update knowledge',
      description:
        "Changes a document of the organization's knowledge: its `title`, and at most one edit of its text, in Markdown, where a [title](doc:<id>) or [name](task:<id>) link mentions a document or a task. `append` adds to the end. `replaceBlocks` replaces the top-level blocks from `fromId` to `toId`, ids read_document gave, and leaves the rest alone. `replaceText` replaces a piece of text that occurs exactly once, for a small change inside a block, and never finds a mention: replace its block to change one. `content` replaces the whole text, only for a document you read whole, with the `version` read_document gave. Members may be typing in the document meanwhile: every edit but `content` merges with what they write, so prefer them. Call it to write what the member agreed into the team's knowledge, then say what changed.",
      inputSchema,
      outputSchema,
      // Destructive, as an edit can rewrite the whole text: a client may ask its member before
      // calling it, by its own policy. Advisory, so the revision each edit keeps is what guards the
      // text, and Claude's tool list never carries an annotation, so it changes no request's bytes
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
      scopeChallenge: requireModuleWriteScope(knowledgeModule),
    },
    async (args, serverContext) => {
      const prepared = readKnowledgeWriteCall(context, serverContext, TOOL, args)

      if (prepared.outcome === 'refused') return prepared.result

      const edit = toEdit(args)
      const updated = await updateDocument(
        context.caller,
        {
          id: args.id,
          ...(args.version !== undefined && { version: args.version }),
          ...(args.title !== undefined && { title: args.title }),
          ...(edit && { edit }),
        },
        prepared.call,
      )

      return toKnowledgeWriteResult(updated, context.toAddress)
    },
  )
}

export default registerUpdateDocument
