import {
  MAX_CONVERSATION_ATTACHMENTS_PER_MESSAGE,
  MAX_CONVERSATION_TITLE_LENGTH,
  MAX_SUBAGENT_BRIEF_LENGTH,
} from 'strategydance-core'
import { z } from 'zod'

import type { SubagentIntegrationCallEnding, SubagentStatus } from '~types'

import { UUID_PATTERN } from '~constants'

import { hasNoNul } from '~modules/moduleSchemas'

export const subagentIdSchema = z.string().regex(UUID_PATTERN, 'A subagent id is a UUID')

export const cursorSchema = z.string().max(1000)

export const SUBAGENT_STATUSES = [
  'QUEUED',
  'WAITING_FOR_SLOT',
  'WORKING',
  'REPORTED',
  'STOPPED',
  'FAILED',
  'INTERRUPTED',
] as const satisfies readonly SubagentStatus[]

export const statusSchema = z.enum(SUBAGENT_STATUSES)

export const SUBAGENT_INTEGRATION_CALL_ENDINGS = [
  'SUCCEEDED',
  'FAILED',
  'UNANSWERED',
  'RUNNING',
] as const satisfies readonly SubagentIntegrationCallEnding[]

export const integrationCallEndingSchema = z.enum(SUBAGENT_INTEGRATION_CALL_ENDINGS)

export const titleSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_CONVERSATION_TITLE_LENGTH)
  .regex(/^[^\r\n]*$/, 'A title is one line')
  .refine(hasNoNul, 'A title holds no U+0000')

export const briefSchema = z
  .string()
  .min(1)
  .max(MAX_SUBAGENT_BRIEF_LENGTH)
  .refine(value => value.trim().length > 0, 'A brief holds more than spaces')
  .refine(hasNoNul, 'A brief holds no U+0000')

export const attachmentsSchema = z
  .array(z.string().regex(UUID_PATTERN, 'A file id is a UUID'))
  .max(MAX_CONVERSATION_ATTACHMENTS_PER_MESSAGE)
