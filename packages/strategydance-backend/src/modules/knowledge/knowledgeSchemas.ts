import { MAX_DOCUMENT_CONTENT_LENGTH, MAX_DOCUMENT_TITLE_LENGTH } from 'strategydance-core'
import { z } from 'zod'

import { UUID_PATTERN } from '~constants'

import { aspectSchema, hasNoNul } from '~modules/moduleSchemas'

export const documentIdSchema = z.string().regex(UUID_PATTERN, 'A document id is a UUID').describe("The document's id")

export const titleSchema = z
  .string()
  .max(MAX_DOCUMENT_TITLE_LENGTH)
  .regex(/^[^\r\n]*$/, 'A title is one line')
  .refine(hasNoNul, 'A title holds no U+0000')

export const markdownSchema = z.string().max(MAX_DOCUMENT_CONTENT_LENGTH).refine(hasNoNul, 'Markdown holds no U+0000')

// What every answer naming a document says of it beside its id, and its web address for an external
// caller
export const documentSummaryShape = {
  id: z.string(),
  title: z.string(),
  aspects: z.array(aspectSchema),
  updatedAt: z.string(),
  isAiWritable: z.boolean(),
  url: z.string().optional(),
}
