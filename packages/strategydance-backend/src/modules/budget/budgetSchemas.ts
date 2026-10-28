import {
  MAX_BILL_COMPANY_LENGTH,
  MAX_BILL_DESCRIPTION_LENGTH,
  MAX_BILL_NAME_LENGTH,
  MAX_BILL_RECEIPT_NAME_LENGTH,
  MAX_BILL_RECEIPT_TEXT_LENGTH,
  MAX_SEARCH_QUERY_LENGTH,
} from 'strategydance-core'
import { BillRecurrence, BudgetPeriod, Currency } from 'strategydance-database/backend'
import { z } from 'zod'

import { UUID_PATTERN } from '~constants'

import { hasNoNul } from '~modules/moduleSchemas'

// A base64 receipt's characters at most: past what a body of 1 MiB carries, so the module's own
// check, which names the size, refuses one too large once decoded
const MAX_RECEIPT_BASE64_LENGTH = 1024 * 1024

export const billIdSchema = z.string().regex(UUID_PATTERN, 'A bill id is a UUID')
export const currencySchema = z.enum(Currency)
export const recurrenceSchema = z.enum(BillRecurrence)
export const periodSchema = z.enum(BudgetPeriod)

function oneLineSchema(field: string, maxLength: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(maxLength)
    .regex(/^[^\r\n]*$/, `A ${field} is one line`)
    .refine(hasNoNul, `A ${field} holds no U+0000`)
}

export const billNameSchema = oneLineSchema('name', MAX_BILL_NAME_LENGTH)
export const companySchema = oneLineSchema('company', MAX_BILL_COMPANY_LENGTH)
export const descriptionSchema = z
  .string()
  .trim()
  .max(MAX_BILL_DESCRIPTION_LENGTH)
  .refine(hasNoNul, 'A description holds no U+0000')

// A decimal string, which the module then holds to its currency's decimals
export const amountSchema = z.string().max(40)
export const daySchema = z.iso.date()
export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'A month is YYYY-MM')
  .refine(month => month >= '1999-01' && month <= '2100-12', 'A month is from 1999-01')
export const payerSchema = z.union([
  z.literal('me'),
  z
    .string()
    .max(200)
    .regex(/^member:.+$/, 'A member is named as member:<id>')
    .refine(hasNoNul, 'A member id holds no U+0000'),
])
export const querySchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_SEARCH_QUERY_LENGTH)
  .refine(hasNoNul, 'A query holds no U+0000')

const receiptNameSchema = oneLineSchema("receipt's name", MAX_BILL_RECEIPT_NAME_LENGTH)

export const receiptSchema = z.union([
  z.object({
    name: receiptNameSchema.describe("The file's name, as Invoice-2026-10.pdf"),
    contentType: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']).describe("The file's type"),
    base64: z
      .base64()
      .max(MAX_RECEIPT_BASE64_LENGTH)
      .describe("The file's bytes in base64, 700 KiB at most once decoded"),
  }),
  z.object({
    name: receiptNameSchema.describe('A name for the receipt, as Invoice-2026-10.txt'),
    text: z
      .string()
      .min(1)
      .max(MAX_BILL_RECEIPT_TEXT_LENGTH)
      .describe(`The receipt's text, ${MAX_BILL_RECEIPT_TEXT_LENGTH} characters at most, kept as text/plain`),
  }),
  z.object({
    attachmentId: z.string().max(200).describe('A file the member sent in this conversation, by its id'),
  }),
])

// A payment as a bill's answer gives it: its day and its amount in the budget's currency
const paymentSchema = z.object({ day: z.string(), convertedAmount: z.string().nullable() })

export const billShape = {
  id: z.string(),
  name: z.string(),
  description: z.string(),
  company: z.string(),
  amount: z.string(),
  currency: currencySchema,
  paidOn: z.string(),
  recurrence: recurrenceSchema.nullable(),
  endsOn: z.string().nullable(),
  paidBy: z.string().nullable(),
  paidByName: z.string().nullable(),
  hasReceipt: z.boolean(),
  lastPayment: paymentSchema,
  nextPayment: paymentSchema.nullable(),
  isActive: z.boolean(),
  url: z.string().optional(),
}

export const statusSchema = z
  .object({
    level: z.enum(['over', 'warn']),
    scope: z.enum(['month', 'quarter', 'year']),
    by: z.string(),
    limit: z.string(),
    expected: z.string(),
  })
  .nullable()
