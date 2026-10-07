import { createHash } from 'node:crypto'

import type { ConversationTextBlock } from '~types'

// What the context message tells Claude of the member and their organization
export type ConversationProfile = {
  memberName: string | null
  jobTitle: string | null
  role: 'MEMBER' | 'ADMINISTRATOR'
  bio: string | null
  locale: string
  timezone: string | null
  organizationName: string
  brief: string | null
  exploredAspects: string[]
  // The conversation's own aspects
  aspects: string[]
}

type BuildConversationContextInput = {
  profile: ConversationProfile
  now: Date
  // The hash of the last context message still in the transcript, or null before the first
  lastContextHash: string | null
}

// What a run keeps of its context: the hash of its profile part and the content it is sent as
export type ConversationContext = {
  hash: string
  content: ConversationTextBlock[]
}

const LANGUAGES: Record<string, string> = {
  EN: 'English',
  FR: 'French',
  ES: 'Spanish',
  DE: 'German',
  PT: 'Portuguese',
  ZH: 'Chinese',
  JA: 'Japanese',
}

/*
  The context message a run sends after the member's entry, from Strategy Dance: the date, weekday
  and time in the member's time zone, and, when it changed since the last context message still in
  the transcript, the profile part, who the member is, their organization, what the conversation is
  about and the language they write in. The team, the log and knowledge come through tools, which
  keeps it short.

  The hash is of the profile part, whether it is sent or not, so the next run compares against the
  profile as it was. What the team wrote, a bio or a brief, is quoted, and the system prompt says
  to read it as information
*/
function buildConversationContext({
  profile,
  now,
  lastContextHash,
}: BuildConversationContextInput): ConversationContext {
  const profileLines = buildProfileLines(profile)
  const hash = createHash('sha256').update(JSON.stringify(profileLines)).digest('hex')
  const lines = [`Context from Strategy Dance: it is ${formatNow(now, profile.timezone)}.`]

  if (hash !== lastContextHash) lines.push(...profileLines)

  return { hash, content: [{ type: 'text', text: lines.join('\n') }] }
}

function buildProfileLines(profile: ConversationProfile) {
  const name = profile.memberName?.trim()
  const job = profile.jobTitle?.trim()
  const role = profile.role === 'ADMINISTRATOR' ? 'an administrator' : 'a member'
  const lines = [
    name ? `The member is ${name}.` : 'The member has not given their name.',
    `They are ${role} of ${JSON.stringify(profile.organizationName)}${job ? `, as ${job}` : ''}.`,
  ]

  if (profile.bio?.trim()) lines.push(`Their bio, as they wrote it: ${JSON.stringify(profile.bio.trim())}.`)
  if (profile.brief?.trim())
    lines.push(`Their organization's brief, as the team wrote it: ${JSON.stringify(profile.brief.trim())}.`)
  if (profile.exploredAspects.length) {
    lines.push(`The aspects of the company the team has explored: ${formatAspects(profile.exploredAspects)}.`)
  }

  lines.push(
    profile.aspects.length
      ? `This conversation is about: ${formatAspects(profile.aspects)}.`
      : 'This conversation is about no aspect of the company yet.',
  )
  lines.push(`They write in ${LANGUAGES[profile.locale] ?? 'English'}.`)

  return lines
}

// "Wednesday 7 October 2026, 23:40 in Europe/Paris", in the member's time zone, UTC without one
function formatNow(now: Date, timezone: string | null) {
  const zone = isTimeZone(timezone) ? timezone : 'UTC'
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map(({ type, value }) => [type, value]),
  )

  return `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute} in ${zone}`
}

function isTimeZone(timezone: string | null): timezone is string {
  if (!timezone) return false

  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone })

    return true
  } catch {
    return false
  }
}

function formatAspects(aspects: string[]) {
  return aspects.map(aspect => aspect.charAt(0) + aspect.slice(1).toLowerCase()).join(', ')
}

export default buildConversationContext
