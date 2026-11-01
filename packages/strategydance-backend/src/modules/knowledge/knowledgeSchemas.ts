import { KnowledgeKind, MAX_SEARCH_QUERY_LENGTH, MAX_SEARCH_TERMS, splitSearchTerms } from 'strategydance-core'
import { TaskStatus } from 'strategydance-database/backend'
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

import { UUID_PATTERN } from '~constants'

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

export const documentIdSchema = z.string().regex(UUID_PATTERN, 'A document id is a UUID')

export const taskIdSchema = z.string().regex(UUID_PATTERN, 'A task id is a UUID')

// A member, `"me"` or `"member:<id>"`, as a task's assignee is named, so no member's id is read as the
// word
export const memberSchema = z.union([
  z.literal('me'),
  z
    .string()
    .max(200)
    .regex(/^member:.+$/, 'A member is named as member:<id>')
    .refine(hasNoNul, 'A member id holds no U+0000'),
])

// The one target a link or an unlink names, each optional in the schema, which takes no union of
// objects a client could fill: the module refuses none or more than one
export const linkTargetShape = {
  documentId: documentIdSchema.optional().describe("A document's id, as the documents' tools give it"),
  taskId: taskIdSchema.optional().describe("A task's id, as the tasks' tools give it"),
  member: memberSchema
    .optional()
    .describe('"me" for the member you act as, or "member:<id>" for another member, as the tasks name them'),
}

// What every item has, whatever its kind
const itemShape = { id: z.string(), name: z.string(), description: z.string() }

// What every row has: an item's fields, and whether the organization uses it
const rowShape = { ...itemShape, inUse: z.boolean() }

/*
  An item as a list shows it, by kind: a tactic's and a directory's first, since a framework's fields
  are the ones every row has
*/
export const knowledgeRowSchema = z.union([
  z.object({
    ...rowShape,
    channel: z.enum(MarketingTacticChannel),
    effort: z.enum(MarketingTacticEffort),
    paid: z.boolean(),
    timeToResults: z.enum(MarketingTacticTimeToResults),
    technical: z.boolean(),
  }),
  z.object({
    ...rowShape,
    type: z.enum(DirectoryType),
    categories: z.array(z.enum(DirectoryCategory)),
    businessModel: z.enum(DirectoryBusinessModel),
    inactiveReason: z.enum(DirectoryInactiveReason).optional(),
  }),
  z.object(rowShape),
])

// A value of one of the package's enums, with what it means
function toMeaningSchema<const Values extends Record<string, string>>(values: Values) {
  return z.object({ value: z.enum(values), meaning: z.string() })
}

// Whether the organization uses an item and since when, null when the agent never marked it
export const useSchema = z.object({ inUse: z.boolean(), changedAt: z.string() }).nullable()

// An item's newest links to one kind of target, and how many it has in all
function toLinksSchema<const Shape extends z.ZodRawShape>(shape: Shape) {
  return z.object({ items: z.array(z.object(shape)), total: z.int() })
}

export const documentReferenceShape = { id: z.string(), title: z.string() }

export const taskReferenceShape = { id: z.string(), name: z.string(), status: z.enum(TaskStatus) }

export const memberReferenceShape = { member: z.string(), name: z.string().nullable() }

// A link's target as a link or an unlink answers it, one of the three
export const linkReferenceShape = {
  document: z.object(documentReferenceShape).optional(),
  task: z.object(taskReferenceShape).optional(),
  member: z.object(memberReferenceShape).optional(),
}

// What the organization keeps of an item read whole, after its own fields
const stateShape = {
  use: useSchema,
  documents: toLinksSchema(documentReferenceShape),
  tasks: toLinksSchema(taskReferenceShape),
  members: toLinksSchema(memberReferenceShape),
}

// An item read whole, by kind, with what the organization keeps of it
export const knowledgeItemSchema = z.union([
  z.object({
    ...itemShape,
    whenToUse: z.string(),
    inputs: z.array(z.string()),
    questions: z.array(z.string()),
    output: z.string(),
    ...stateShape,
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
    ...stateShape,
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
    ...stateShape,
  }),
])
