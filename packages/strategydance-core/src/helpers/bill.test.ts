import { describe, expect, it } from 'bun:test'

import type { BillRecurrence, BillSchedule } from '../types'

import { getLastBillPayment, getNextBillPayment, hasBillPaymentWithin, isBillActive, listBillPayments } from './bill'
import { addCalendarDays } from './calendarDay'

function makeBill(
  paidOn: string,
  recurrence: BillRecurrence | null = null,
  endsOn: string | null = null,
): BillSchedule {
  return { paidOn, recurrence, endsOn }
}

describe('listBillPayments', () => {
  it('pays a one-time bill on its day alone', () => {
    const bill = makeBill('2026-10-06')

    expect(listBillPayments(bill, '2026-10-01', '2026-10-31')).toEqual(['2026-10-06'])
    expect(listBillPayments(bill, '2026-10-06', '2026-10-06')).toEqual(['2026-10-06'])
    expect(listBillPayments(bill, '2026-10-07', '2026-12-31')).toEqual([])
  })

  it("pays a monthly bill started January 31 on February's last day, then March 31", () => {
    expect(listBillPayments(makeBill('2026-01-31', 'MONTHLY'), '2026-01-01', '2026-05-31')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ])
  })

  it('pays it on February 29 in a leap year', () => {
    expect(listBillPayments(makeBill('2028-01-31', 'MONTHLY'), '2028-02-01', '2028-03-31')).toEqual([
      '2028-02-29',
      '2028-03-31',
    ])
  })

  it('pays a weekly bill every seven days, across a month', () => {
    expect(listBillPayments(makeBill('2026-09-17', 'WEEKLY'), '2026-10-01', '2026-10-31')).toEqual([
      '2026-10-01',
      '2026-10-08',
      '2026-10-15',
      '2026-10-22',
      '2026-10-29',
    ])
  })

  it('stops a quarterly bill after its end', () => {
    const bill = makeBill('2025-01-15', 'QUARTERLY', '2026-02-01')

    expect(listBillPayments(bill, '2024-01-01', '2027-12-31')).toEqual([
      '2025-01-15',
      '2025-04-15',
      '2025-07-15',
      '2025-10-15',
      '2026-01-15',
    ])
    expect(listBillPayments(bill, '2026-01-16', '2027-12-31')).toEqual([])
  })

  it('pays on an end day that falls on a payment', () => {
    expect(listBillPayments(makeBill('2026-01-15', 'MONTHLY', '2026-03-15'), '2026-01-01', '2026-12-31')).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
    ])
  })

  it('pays a yearly bill started on February 29 on the 28th in other years', () => {
    expect(listBillPayments(makeBill('2024-02-29', 'YEARLY'), '2024-01-01', '2028-12-31')).toEqual([
      '2024-02-29',
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
    ])
  })

  it('starts within the window rather than at the first payment', () => {
    expect(listBillPayments(makeBill('2000-01-31', 'MONTHLY'), '2026-02-01', '2026-03-31')).toEqual([
      '2026-02-28',
      '2026-03-31',
    ])
    expect(listBillPayments(makeBill('2000-01-03', 'WEEKLY'), '2026-10-15', '2026-10-25')).toEqual(['2026-10-19'])
  })

  it('lists from within the window what it lists walking from the first payment', () => {
    const bills = [
      makeBill('2024-01-31', 'MONTHLY'),
      makeBill('2024-02-29', 'QUARTERLY'),
      makeBill('2023-08-31', 'YEARLY', '2027-09-01'),
      makeBill('2024-12-30', 'WEEKLY'),
      makeBill('2025-11-30', 'MONTHLY', '2026-06-29'),
    ]
    const windows = [
      ['2026-02-28', '2026-02-28'],
      ['2026-03-01', '2026-03-31'],
      ['2025-12-31', '2026-01-30'],
      ['2026-06-29', '2027-02-28'],
    ] as const

    for (const bill of bills) {
      for (const [from, to] of windows) {
        const walked = listBillPayments(bill, bill.paidOn, to).filter(day => day >= from)

        expect(listBillPayments(bill, from, to)).toEqual(walked)
      }
    }
  })

  it('ends with its 3000th payment', () => {
    const bill = makeBill('1990-01-01', 'WEEKLY')
    const payments = listBillPayments(bill, '1990-01-01', '2100-12-31')

    expect(payments.length).toBe(3000)
    expect(payments.at(-1)).toBe(addCalendarDays('1990-01-01', 7 * 2999))
    expect(listBillPayments(bill, addCalendarDays('1990-01-01', 7 * 2999 + 1), '2100-12-31')).toEqual([])
    expect(listBillPayments(bill, '2040-01-01', '2100-12-31').at(-1)).toBe(payments.at(-1))
  })
})

describe('getLastBillPayment', () => {
  it("is a running bill's last payment on or before today", () => {
    expect(getLastBillPayment(makeBill('2025-12-03', 'MONTHLY'), '2026-10-19')).toBe('2026-10-03')
    expect(getLastBillPayment(makeBill('2026-01-21', 'MONTHLY'), '2026-10-21')).toBe('2026-10-21')
    expect(getLastBillPayment(makeBill('2026-01-21', 'MONTHLY'), '2026-10-20')).toBe('2026-09-21')
  })

  it('is the first payment while it is still ahead', () => {
    expect(getLastBillPayment(makeBill('2026-11-01', 'MONTHLY'), '2026-10-19')).toBe('2026-11-01')
    expect(getLastBillPayment(makeBill('2026-11-01'), '2026-10-19')).toBe('2026-11-01')
  })

  it("is an ended bill's last payment before its end", () => {
    expect(getLastBillPayment(makeBill('2025-01-15', 'QUARTERLY', '2026-02-01'), '2026-10-19')).toBe('2026-01-15')
  })

  it('stops at the 3000th payment', () => {
    expect(getLastBillPayment(makeBill('1990-01-01', 'WEEKLY'), '2100-01-01')).toBe(
      addCalendarDays('1990-01-01', 7 * 2999),
    )
  })
})

describe('getNextBillPayment and isBillActive', () => {
  it("find a running bill's next payment, and count it active", () => {
    const bill = makeBill('2026-01-21', 'MONTHLY')

    expect(getNextBillPayment(bill, '2026-10-19')).toBe('2026-10-21')
    expect(getNextBillPayment(bill, '2026-10-21')).toBe('2026-11-21')
    expect(isBillActive(bill, '2026-10-19')).toBe(true)
  })

  it('find a bill due later, its first payment', () => {
    expect(getNextBillPayment(makeBill('2026-11-01', 'YEARLY'), '2026-10-19')).toBe('2026-11-01')
    expect(getNextBillPayment(makeBill('2026-11-01'), '2026-10-19')).toBe('2026-11-01')
    expect(isBillActive(makeBill('2026-11-01'), '2026-10-19')).toBe(false)
  })

  it('find nothing for an ended bill, a paid one-time bill, or a payment past two years', () => {
    expect(getNextBillPayment(makeBill('2025-01-15', 'QUARTERLY', '2026-02-01'), '2026-10-19')).toBeNull()
    expect(isBillActive(makeBill('2025-01-15', 'QUARTERLY', '2026-02-01'), '2026-10-19')).toBe(false)
    expect(getNextBillPayment(makeBill('2026-10-06'), '2026-10-19')).toBeNull()
    expect(getNextBillPayment(makeBill('2029-01-01', 'YEARLY'), '2026-10-19')).toBeNull()
  })

  it('find a weekly bill past its 3000th payment ended', () => {
    expect(getNextBillPayment(makeBill('1990-01-01', 'WEEKLY'), '2050-01-01')).toBeNull()
    expect(isBillActive(makeBill('1990-01-01', 'WEEKLY'), '2050-01-01')).toBe(false)
  })

  it('count a subscription starting over two years ahead active, which has no next payment within them', () => {
    expect(isBillActive(makeBill('2029-06-01', 'MONTHLY'), '2026-10-19')).toBe(true)
    expect(isBillActive(makeBill('2029-06-01', 'MONTHLY', '2029-06-01'), '2026-10-19')).toBe(true)
    expect(isBillActive(makeBill('2026-10-19', 'MONTHLY', '2026-10-19'), '2026-10-19')).toBe(false)
  })
})

describe('hasBillPaymentWithin', () => {
  it('tells whether a bill pays within a stretch, as listing its payments would', () => {
    const bills = [
      makeBill('2026-01-31', 'MONTHLY'),
      makeBill('2025-01-15', 'QUARTERLY', '2026-02-01'),
      makeBill('2026-03-10'),
      makeBill('1999-01-04', 'WEEKLY'),
      makeBill('2024-02-29', 'YEARLY'),
    ]
    const stretches = [
      ['2026-02-01', '2026-02-27'],
      ['2026-02-28', '2026-02-28'],
      ['2026-04-01', '2026-12-31'],
      ['2026-03-10', '2026-03-10'],
      ['1999-01-05', '1999-01-10'],
      ['2025-02-28', '2025-02-28'],
      ['2027-01-01', '2026-01-01'],
    ] as const

    for (const bill of bills) {
      for (const [from, to] of stretches) {
        expect(hasBillPaymentWithin(bill, from, to)).toBe(from <= to && listBillPayments(bill, from, to).length > 0)
      }
    }
  })
})
