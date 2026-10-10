import { MAX_SEARCH_QUERY_LENGTH, MAX_TASK_DESCRIPTION_LENGTH, MAX_TASK_NAME_LENGTH } from 'strategydance-core'
import { TaskStatus } from 'strategydance-database/backend'
import { z } from 'zod'

import { UUID_PATTERN } from '~constants'

import { aspectSchema, hasNoNul } from '~modules/moduleSchemas'

export const taskIdSchema = z.string().regex(UUID_PATTERN, 'A task id is a UUID')

export const statusSchema = z.enum(TaskStatus)

export const taskNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_TASK_NAME_LENGTH)
  .regex(/^[^\r\n]*$/, 'A name is one line')
  .refine(hasNoNul, 'A name holds no U+0000')

// Markdown can run longer than the blocks it is stored as, an escaped character one longer, so the
// bound that counts is the stored one, which the module checks once it has written them
export const descriptionSchema = z
  .string()
  .max(MAX_TASK_DESCRIPTION_LENGTH * 2)
  .refine(hasNoNul, 'A description holds no U+0000')

export const querySchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_SEARCH_QUERY_LENGTH)
  .refine(hasNoNul, 'A query holds no U+0000')

// Who does a task: `"me"`, `"agent"` for Strategy Dance, `"unassigned"`, or `"member:<id>"`, the board's
// own encodings, so no member's id is read as one of the words
export const assigneeSchema = z.union([
  z.enum(['me', 'agent', 'unassigned']),
  z
    .string()
    .max(200)
    .regex(/^member:.+$/, 'A member is named as member:<id>')
    .refine(hasNoNul, 'A member id holds no U+0000'),
])

export const dueDateSchema = z.iso.date()

// A task named in an answer: its id and its name
export const taskReferenceShape = {
  id: z.string(),
  name: z.string(),
}

// How many tasks a list holds in all, the first of which an answer names
export const taskReferencesSchema = z.object({
  tasks: z.array(z.object(taskReferenceShape)),
  count: z.int(),
})

// What every answer naming a task on the board says of it beside its id
export const listedTaskShape = {
  ...taskReferenceShape,
  status: statusSchema,
  assignee: z.string(),
  assigneeName: z.string().nullable().optional(),
  dueDate: z.string().nullable(),
  aspects: z.array(aspectSchema),
  dependsOnIds: z.array(z.string()),
  isBlocked: z.boolean(),
  updatedAt: z.string(),
  url: z.string().optional(),
}
