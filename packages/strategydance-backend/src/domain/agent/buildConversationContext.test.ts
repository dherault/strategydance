import { describe, expect, test } from 'bun:test'

import buildConversationContext, { type ConversationProfile } from './buildConversationContext'

const PROFILE: ConversationProfile = {
  memberName: 'Ada',
  jobTitle: 'Founder',
  role: 'ADMINISTRATOR',
  bio: 'Builds tools for "solo" founders',
  locale: 'FR',
  timezone: 'Europe/Paris',
  organizationName: 'Acme',
  brief: 'Pricing software',
  exploredAspects: ['STRATEGY', 'PRODUCT'],
  aspects: ['SALES'],
}

// A Wednesday, 21:40 in UTC, 23:40 in Paris
const NOW = new Date('2026-10-07T21:40:00Z')

function readText(context: ReturnType<typeof buildConversationContext>) {
  return context.content.map(({ text }) => text).join('')
}

describe('buildConversationContext', () => {
  test('tells the date and time in the member’s time zone, and the profile the first time', () => {
    const context = buildConversationContext({ profile: PROFILE, now: NOW, lastContextHash: null })
    const text = readText(context)

    expect(context.content).toEqual([{ type: 'text', text }])
    expect(text).toStartWith('Context from Strategy Dance: it is Wednesday 7 October 2026, 23:40 in Europe/Paris.')
    expect(text).toContain('The member is Ada.\nThey are an administrator of "Acme", as Founder.')
    expect(text).toContain('Their bio, as they wrote it: "Builds tools for \\"solo\\" founders".')
    expect(text).toContain('The aspects of the company the team has explored: Strategy, Product.')
    expect(text).toContain('This conversation is about: Sales.')
    expect(text).toContain('They write in French.')
  })

  test('leaves the profile out while its hash is the last context’s, and keeps the hash', () => {
    const first = buildConversationContext({ profile: PROFILE, now: NOW, lastContextHash: null })
    const next = buildConversationContext({ profile: PROFILE, now: NOW, lastContextHash: first.hash })

    expect(next.hash).toBe(first.hash)
    expect(readText(next)).toBe('Context from Strategy Dance: it is Wednesday 7 October 2026, 23:40 in Europe/Paris.')
  })

  test('sends the profile again once it changed', () => {
    const first = buildConversationContext({ profile: PROFILE, now: NOW, lastContextHash: null })
    const next = buildConversationContext({
      profile: { ...PROFILE, aspects: ['SALES', 'MARKETING'] },
      now: NOW,
      lastContextHash: first.hash,
    })

    expect(next.hash).not.toBe(first.hash)
    expect(readText(next)).toContain('This conversation is about: Sales, Marketing.')
  })

  test('falls back to UTC, and words what is missing', () => {
    const text = readText(
      buildConversationContext({
        profile: {
          ...PROFILE,
          memberName: null,
          jobTitle: null,
          role: 'MEMBER',
          bio: null,
          brief: null,
          exploredAspects: [],
          aspects: [],
          timezone: 'Nowhere/City',
        },
        now: NOW,
        lastContextHash: null,
      }),
    )

    expect(text).toContain('Wednesday 7 October 2026, 21:40 in UTC.')
    expect(text).toContain('The member has not given their name.\nThey are a member of "Acme".')
    expect(text).not.toContain('bio')
    expect(text).toContain('This conversation is about no aspect of the company yet.')
  })
})
