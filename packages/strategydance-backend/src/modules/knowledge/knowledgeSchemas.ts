import { MAX_DOCUMENT_CONTENT_LENGTH, MAX_DOCUMENT_TITLE_LENGTH } from 'strategydance-core'
import { CompanyAspect } from 'strategydance-database/backend'
import { z } from 'zod'

import { UUID_PATTERN } from '~constants'

// Postgres refuses U+0000 in any text, so no argument holds it
export const hasNoNul = (value: string) => !value.includes('\u0000')

export const documentIdSchema = z.string().regex(UUID_PATTERN, 'A document id is a UUID').describe("The document's id")

export const aspectSchema = z.enum(CompanyAspect)

export const aspectsSchema = z
  .array(aspectSchema)
  .refine(aspects => new Set(aspects).size === aspects.length, 'Name each aspect at most once')

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
