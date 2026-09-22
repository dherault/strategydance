import { describe, expect, it } from 'bun:test'

import { isValidTimezone, resolveSystemTimezone } from './timezone'

describe('isValidTimezone', () => {
  it('accepts absent and null, which mean the reader has no zone', () => {
    expect(isValidTimezone(null)).toBe(true)
    expect(isValidTimezone(undefined)).toBe(true)
  })

  it('accepts the identifier shapes Intl reports', () => {
    expect(isValidTimezone('UTC')).toBe(true)
    expect(isValidTimezone('Europe/Helsinki')).toBe(true)
    expect(isValidTimezone('America/Argentina/Buenos_Aires')).toBe(true)
    expect(isValidTimezone('America/Port-au-Prince')).toBe(true)
    expect(isValidTimezone('Etc/GMT+1')).toBe(true)
  })

  it('keeps an alias rather than demanding its canonical name', () => {
    expect(isValidTimezone('Asia/Calcutta')).toBe(true)
  })

  it('refuses the offset form, which carries no daylight saving rules', () => {
    expect(isValidTimezone('+05:00')).toBe(false)
    expect(isValidTimezone('-08:00')).toBe(false)
  })

  it('refuses a well shaped identifier that names no real zone', () => {
    expect(isValidTimezone('Europe/Atlantis')).toBe(false)
  })

  it('refuses empty and obviously malformed input', () => {
    expect(isValidTimezone('')).toBe(false)
    expect(isValidTimezone('Europe//Helsinki')).toBe(false)
    expect(isValidTimezone('Europe/Helsinki ')).toBe(false)
  })
})

describe('resolveSystemTimezone', () => {
  it('reports a zone it would itself accept', () => {
    const timezone = resolveSystemTimezone()

    expect(isValidTimezone(timezone)).toBe(true)
  })
})
