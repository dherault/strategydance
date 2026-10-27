import { describe, expect, test } from 'bun:test'

import type { BetaStopReason } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import type { BillReceiptFields } from 'strategydance-core'

import createClaudeMessage from '~domain/agent/createClaudeMessage'
import { BILL_RECEIPT_READ_MODEL } from '~domain/budget/billReceiptReadSettings'

import readBillReceiptFields from './readBillReceiptFields'

const TODAY = '2026-10-27'

const FIELDS: BillReceiptFields = {
  name: 'Figma Professional',
  description: 'Design seats for October',
  company: 'Figma',
  amount: '45.00',
  currency: 'USD',
  paidOn: '2026-10-03',
  recurrence: 'MONTHLY',
}

function answer(texts: string[], stopReason: BetaStopReason = 'end_turn') {
  return createClaudeMessage({
    content: texts.map(text => ({ type: 'text' as const, text, citations: null })),
    stopReason,
    model: BILL_RECEIPT_READ_MODEL,
  })
}

function read(fields: Record<string, unknown>) {
  return readBillReceiptFields(answer([JSON.stringify({ ...FIELDS, ...fields })]), { today: TODAY })
}

describe('readBillReceiptFields', () => {
  test('reads the fields answered', () => {
    expect(read({})).toEqual(FIELDS)
  })

  test('reads a text a fallback carried on as one answer', () => {
    const [start, end] = [JSON.stringify(FIELDS).slice(0, 20), JSON.stringify(FIELDS).slice(20)]

    expect(readBillReceiptFields(answer([start!, end!]), { today: TODAY })).toEqual(FIELDS)
  })

  test('puts the name, the description and the company on one line, within a bill’s lengths', () => {
    const fields = read({
      name: `  Office\nchairs ${'x'.repeat(100)}`,
      description: '\tFor the\r\nnew room  ',
      company: '🪑'.repeat(70),
    })

    expect(fields?.name).toBe(`Office chairs ${'x'.repeat(66)}`)
    expect(fields?.name).toHaveLength(80)
    expect(fields?.description).toBe('For the new room')
    expect(fields?.company).toBe('🪑'.repeat(60))
  })

  test('leaves empty an amount that names no total a bill takes', () => {
    expect(read({ amount: '1,500.00' })?.amount).toBeNull()
    expect(read({ amount: '$45' })?.amount).toBeNull()
    expect(read({ amount: '0.00' })?.amount).toBeNull()
    expect(read({ amount: '-12.00' })?.amount).toBeNull()
    expect(read({ amount: '1500.5', currency: 'JPY' })?.amount).toBeNull()
    expect(read({ amount: null })?.amount).toBeNull()
  })

  test('keeps an amount as the receipt wrote it, checked as two decimals when no currency is known', () => {
    expect(read({ amount: ' 1500 ', currency: 'JPY' })?.amount).toBe('1500')
    expect(read({ amount: '12.5', currency: null })?.amount).toBe('12.5')
    expect(read({ amount: '12.505', currency: 'AED' })).toMatchObject({ amount: null, currency: null })
  })

  test('answers null for a currency or a recurrence it does not know', () => {
    expect(read({ currency: 'AED', recurrence: 'DAILY' })).toMatchObject({ currency: null, recurrence: null })
    expect(read({ currency: null, recurrence: null })).toMatchObject({ currency: null, recurrence: null })
  })

  test('takes today for a day that is not one, or one a bill cannot be paid on', () => {
    expect(read({ paidOn: null })?.paidOn).toBe(TODAY)
    expect(read({ paidOn: '2026-02-30' })?.paidOn).toBe(TODAY)
    expect(read({ paidOn: 'October 3' })?.paidOn).toBe(TODAY)
    expect(read({ paidOn: '1998-12-31' })?.paidOn).toBe(TODAY)
    expect(read({ paidOn: '2036-10-26' })?.paidOn).toBe('2036-10-26')
    expect(read({ paidOn: '2036-10-27' })?.paidOn).toBe(TODAY)
  })

  test('answers null for anything but the schema’s JSON', () => {
    expect(readBillReceiptFields(answer(['Figma, $45']), { today: TODAY })).toBeNull()
    expect(readBillReceiptFields(answer([JSON.stringify({ ...FIELDS, name: 12 })]), { today: TODAY })).toBeNull()
    expect(readBillReceiptFields(answer([]), { today: TODAY })).toBeNull()
  })

  test('answers null for a refusal, or an answer cut at its length', () => {
    expect(readBillReceiptFields(answer([JSON.stringify(FIELDS)], 'refusal'), { today: TODAY })).toBeNull()
    expect(readBillReceiptFields(answer(['{"name":"Fig'], 'max_tokens'), { today: TODAY })).toBeNull()
  })
})
