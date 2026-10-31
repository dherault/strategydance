import { KnowledgeKind, MAX_SEARCH_QUERY_LENGTH, MAX_SEARCH_TERMS, splitSearchTerms } from 'strategydance-core'
import {
  DirectoryBusinessModel,
  DirectoryCategory,
  DirectoryInactiveReason,
  DirectoryType,
  KNOWLEDGE_ID_PATTERN,
  MarketingTacticChannel,
  MarketingTacticEffort,
  MarketingTacticTimeToResults,
} from 'strategydance-knowledge'
import { z } from 'zod'

import { hasNoNul } from '~modules/moduleSchemas'

// The longest id a call takes, twice the longest the catalogue holds
const MAX_KNOWLEDGE_ID_LENGTH = 100

export const kindSchema = z.enum(KnowledgeKind)

export const knowledgeIdSchema = z
  .string()
  .max(MAX_KNOWLEDGE_ID_LENGTH)
  .regex(KNOWLEDGE_ID_PATTERN, 'An id is lowercase letters and digits, in words joined by single dashes')

export const querySchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_SEARCH_QUERY_LENGTH)
  .refine(
    query => splitSearchTerms(query).length <= MAX_SEARCH_TERMS,
    `A query holds at most ${MAX_SEARCH_TERMS} words`,
  )
  .refine(hasNoNul, 'A query holds no U+0000')

export const categoriesSchema = z
  .array(z.enum(DirectoryCategory))
  .min(1)
  .refine(categories => new Set(categories).size === categories.length, 'Name each category at most once')

export const businessModelsSchema = z
  .array(z.enum(DirectoryBusinessModel))
  .min(1)
  .refine(models => new Set(models).size === models.length, 'Name each business model at most once')

export const cursorSchema = z.string().max(1000)

// What every item has, whatever its kind
const itemShape = { id: z.string(), name: z.string(), description: z.string() }

/*
  An item as a list shows it, by kind: a tactic's and a directory's first, since a framework's fields
  are the ones every item has
*/
export const knowledgeRowSchema = z.union([
  z.object({
    ...itemShape,
    channel: z.enum(MarketingTacticChannel),
    effort: z.enum(MarketingTacticEffort),
    paid: z.boolean(),
    timeToResults: z.enum(MarketingTacticTimeToResults),
    technical: z.boolean(),
  }),
  z.object({
    ...itemShape,
    type: z.enum(DirectoryType),
    categories: z.array(z.enum(DirectoryCategory)),
    businessModel: z.enum(DirectoryBusinessModel),
  }),
  z.object(itemShape),
])

// A value of one of the package's enums, with what it means
function toMeaningSchema<const Values extends Record<string, string>>(values: Values) {
  return z.object({ value: z.enum(values), meaning: z.string() })
}

// An item read whole, by kind
export const knowledgeItemSchema = z.union([
  z.object({
    ...itemShape,
    whenToUse: z.string(),
    inputs: z.array(z.string()),
    questions: z.array(z.string()),
    output: z.string(),
  }),
  z.object({
    ...itemShape,
    howTo: z.string(),
    channel: toMeaningSchema(MarketingTacticChannel),
    effort: toMeaningSchema(MarketingTacticEffort),
    paid: z.boolean(),
    timeToResults: toMeaningSchema(MarketingTacticTimeToResults),
    technical: z.boolean(),
    metrics: z.array(z.string()),
  }),
  z.object({
    ...itemShape,
    type: z.enum(DirectoryType),
    rootUrl: z.string(),
    submissionUrl: z.string(),
    categories: z.array(toMeaningSchema(DirectoryCategory)),
    businessModel: toMeaningSchema(DirectoryBusinessModel),
    lastChecked: z.string().nullable(),
    unreachableSince: z.string().nullable(),
    inactiveReason: toMeaningSchema(DirectoryInactiveReason).optional(),
  }),
])
