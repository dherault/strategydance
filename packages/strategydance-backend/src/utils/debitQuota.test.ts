import { describe, expect, it } from 'bun:test'

import debitQuota, { type QuotaWindow } from './debitQuota'

const MINUTE = 60 * 1000

describe('debitQuota', () => {
  it('debits each amount until the limit, then refuses', () => {
    const windows = new Map<string, QuotaWindow>()
    const debit = (amount: number, now = 0) => debitQuota({ windows, key: 'jane', amount, limit: 100, windowMs: 10 * MINUTE, now })

    expect(debit(50).allowed).toBe(true)
    expect(debit(50).allowed).toBe(true)
    expect(debit(1).allowed).toBe(false)
  })

  it('refuses an amount that would pass the limit whole, taking nothing', () => {
    const windows = new Map<string, QuotaWindow>()
    const debit = (amount: number) => debitQuota({ windows, key: 'jane', amount, limit: 100, windowMs: 10 * MINUTE, now: 0 })

    expect(debit(90).allowed).toBe(true)
    expect(debit(20).allowed).toBe(false)
    expect(debit(10).allowed).toBe(true)
  })

  it('says how long until the window reopens, and reopens it', () => {
    const windows = new Map<string, QuotaWindow>()
    const debit = (amount: number, now: number) => debitQuota({ windows, key: 'jane', amount, limit: 10, windowMs: 10 * MINUTE, now })

    debit(10, 0)

    expect(debit(1, 4 * MINUTE)).toEqual({ allowed: false, retryAfterMs: 6 * MINUTE })
    expect(debit(10, 10 * MINUTE).allowed).toBe(true)
  })

  it('keeps each caller apart', () => {
    const windows = new Map<string, QuotaWindow>()

    debitQuota({ windows, key: 'jane', amount: 10, limit: 10, windowMs: MINUTE, now: 0 })

    expect(debitQuota({ windows, key: 'sam', amount: 10, limit: 10, windowMs: MINUTE, now: 0 }).allowed).toBe(true)
  })
})
