import { describe, expect, test } from 'bun:test'

import getTimeUntil from './getTimeUntil'

const NOW = Date.parse('2026-10-18T12:00:00Z')
const MINUTE = 60 * 1000

describe('getTimeUntil', () => {
  test('says minutes within the hour, rounded up, a minute at least', () => {
    expect(getTimeUntil(NOW + 10 * 1000, NOW)).toEqual({ unit: 'minute', value: 1 })
    expect(getTimeUntil(NOW - 5 * MINUTE, NOW)).toEqual({ unit: 'minute', value: 1 })
    expect(getTimeUntil(NOW + 5.5 * MINUTE, NOW)).toEqual({ unit: 'minute', value: 6 })
    expect(getTimeUntil(NOW + 59 * MINUTE, NOW)).toEqual({ unit: 'minute', value: 59 })
  })

  test('says hours past it, rounded up', () => {
    expect(getTimeUntil(NOW + 60 * MINUTE, NOW)).toEqual({ unit: 'hour', value: 1 })
    expect(getTimeUntil(NOW + 61 * MINUTE, NOW)).toEqual({ unit: 'hour', value: 2 })
    expect(getTimeUntil(NOW + 23.5 * 60 * MINUTE, NOW)).toEqual({ unit: 'hour', value: 24 })
  })
})
