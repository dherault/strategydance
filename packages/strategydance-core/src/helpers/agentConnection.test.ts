import { describe, expect, it } from 'bun:test'

import { isTimestampAtOrBefore, readAgentConnectionReach } from './agentConnection'

const ACME = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
const BETA = '1a2b3c4d5e6f47089a0b1c2d3e4f5a6b'
const GAMMA = '2b3c4d5e6f7a48190b1c2d3e4f5a6b7c'

describe('isTimestampAtOrBefore', () => {
  it('compares to the microsecond, within one millisecond', () => {
    expect(isTimestampAtOrBefore('2026-11-05T10:00:00.123455Z', '2026-11-05T10:00:00.123456Z')).toBe(true)
    expect(isTimestampAtOrBefore('2026-11-05T10:00:00.123456Z', '2026-11-05T10:00:00.123456Z')).toBe(true)
    expect(isTimestampAtOrBefore('2026-11-05T10:00:00.123457Z', '2026-11-05T10:00:00.123456Z')).toBe(false)
  })

  it('reads a fraction of any length, and none', () => {
    expect(isTimestampAtOrBefore('2026-11-05T10:00:00Z', '2026-11-05T10:00:00.000001Z')).toBe(true)
    expect(isTimestampAtOrBefore('2026-11-05T10:00:00.1Z', '2026-11-05T10:00:00.099999Z')).toBe(false)
    expect(isTimestampAtOrBefore('2026-11-05T10:00:00.5Z', '2026-11-05T10:00:00.500Z')).toBe(true)
    expect(isTimestampAtOrBefore('2026-11-05T10:00:00.123456789Z', '2026-11-05T10:00:00.123456Z')).toBe(true)
  })

  it('reads the zone', () => {
    expect(isTimestampAtOrBefore('2026-11-05T12:00:00.000001+02:00', '2026-11-05T10:00:00Z')).toBe(false)
    expect(isTimestampAtOrBefore('2026-11-05T11:59:59.999999+02:00', '2026-11-05T10:00:00Z')).toBe(true)
  })

  it('never takes a value it cannot read for an earlier one', () => {
    expect(isTimestampAtOrBefore('yesterday', '2026-11-05T10:00:00Z')).toBe(false)
    expect(isTimestampAtOrBefore('2026-11-05T10:00:00Z', '')).toBe(false)
    expect(isTimestampAtOrBefore('2026-11-05 10:00:00Z', '2026-11-05T10:00:00Z')).toBe(false)
  })
})

describe('readAgentConnectionReach', () => {
  const grantedAt = '2026-11-05T10:00:00.500000Z'

  it('keeps the memberships the list names, in their own order', () => {
    const memberships = [
      { organizationId: GAMMA, createdAt: '2026-01-03T00:00:00Z' },
      { organizationId: ACME, createdAt: '2026-01-01T00:00:00Z' },
      { organizationId: BETA, createdAt: '2026-01-02T00:00:00Z' },
    ]

    expect(readAgentConnectionReach({ organizationIds: [ACME, GAMMA], grantedAt }, memberships)).toEqual([
      memberships[0],
      memberships[1],
    ])
  })

  it('matches an id whichever form it comes in', () => {
    const hyphenated = '0F9C2B8E-4B1A-4D2C-9E7F-6A5B4C3D2E1F'
    const memberships = [{ organizationId: hyphenated, createdAt: '2026-01-01T00:00:00Z' }]

    expect(readAgentConnectionReach({ organizationIds: [ACME], grantedAt }, memberships)).toEqual(memberships)
    expect(
      readAgentConnectionReach({ organizationIds: [hyphenated], grantedAt }, [
        { organizationId: ACME, createdAt: '2026-01-01T00:00:00Z' },
      ]),
    ).toHaveLength(1)
  })

  it('leaves out an organization with no membership, as one the member left or that was deleted', () => {
    const memberships = [{ organizationId: ACME, createdAt: '2026-01-01T00:00:00Z' }]

    expect(readAgentConnectionReach({ organizationIds: [ACME, BETA], grantedAt }, memberships)).toEqual(memberships)
  })

  it('leaves out a membership newer than the grant, as one the member was invited back to', () => {
    const memberships = [
      { organizationId: ACME, createdAt: '2026-11-05T10:00:00.500000Z' },
      { organizationId: BETA, createdAt: '2026-11-05T10:00:00.500001Z' },
    ]

    expect(readAgentConnectionReach({ organizationIds: [ACME, BETA], grantedAt }, memberships)).toEqual([
      memberships[0],
    ])
  })

  it('reaches nothing when the list names nothing the member is in', () => {
    expect(
      readAgentConnectionReach({ organizationIds: [GAMMA], grantedAt }, [
        { organizationId: ACME, createdAt: '2026-01-01T00:00:00Z' },
      ]),
    ).toEqual([])
  })
})
