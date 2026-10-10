import { CompanyAspect } from 'strategydance-database/backend'
import { z } from 'zod'

// Postgres refuses U+0000 in any text, so no argument holds it
export const hasNoNul = (value: string) => !value.includes('\u0000')

export const aspectSchema = z.enum(CompanyAspect)

export const aspectsSchema = z
  .array(aspectSchema)
  .refine(aspects => new Set(aspects).size === aspects.length, 'Name each aspect at most once')
