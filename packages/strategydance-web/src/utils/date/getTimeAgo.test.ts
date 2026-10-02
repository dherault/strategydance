import { describe, expect, it } from 'bun:test'

import getTimeAgo from '~utils/date/getTimeAgo'

const NOW = Date.parse('2026-10-02T12:00:00Z')

function ago(ms: number) {
  return new Date(NOW - ms).toISOString()
}

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('getTimeAgo', () => {
  it('says just now under half a minute, and for a clock a little ahead', () => {
    expect(getTimeAgo(ago(20 * 1000), NOW)).toEqual({ unit: 'justNow' })
    expect(getTimeAgo(ago(-5 * 1000), NOW)).toEqual({ unit: 'justNow' })
  })

  it('counts minutes, then hours, then days', () => {
    expect(getTimeAgo(ago(5 * MINUTE), NOW)).toEqual({ unit: 'minute', value: 5 })
    expect(getTimeAgo(ago(59 * MINUTE), NOW)).toEqual({ unit: 'minute', value: 59 })
    expect(getTimeAgo(ago(2 * HOUR), NOW)).toEqual({ unit: 'hour', value: 2 })
    expect(getTimeAgo(ago(26 * HOUR), NOW)).toEqual({ unit: 'day', value: 1 })
    expect(getTimeAgo(ago(6 * DAY), NOW)).toEqual({ unit: 'day', value: 6 })
  })

  it('leaves anything from a week ago on to its date', () => {
    expect(getTimeAgo(ago(7 * DAY), NOW)).toEqual({ unit: 'date' })
    expect(getTimeAgo(ago(200 * DAY), NOW)).toEqual({ unit: 'date' })
  })

  it('reads a Date as well as a timestamp string', () => {
    expect(getTimeAgo(new Date(NOW - 3 * HOUR), NOW)).toEqual({ unit: 'hour', value: 3 })
  })
})
