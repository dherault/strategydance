import {
  getOrganizationById,
  getOrganizationBySlug,
  getUserByEmail,
  liftOrganizationConversationsSuspension,
  liftUserConversationsSuspension,
  suspendOrganizationConversations,
  suspendUserConversations,
} from 'strategydance-database/backend'

import { UUID_PATTERN } from '~constants'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

// Whose conversations a suspension reaches, as staff named it
type SuspensionTarget =
  | { kind: 'account'; id: string; email: string }
  | { kind: 'organization'; id: string; name: string; slug: string | null }

export type SuspensionResult =
  // Suspended, with how many runs in flight it asked to stop, subagents' apart, or lifted
  | { outcome: 'suspended'; target: SuspensionTarget; runCount: number; subagentRunCount: number }
  | { outcome: 'lifted'; target: SuspensionTarget }
  // Nothing by that address, id or slug
  | { outcome: 'missing' }

/*
  Suspends conversations for an account or an organization, or lifts the suspension, as staff's
  `bun run suspend:conversations` asks: an address names an account, and anything else an
  organization, by its id, hyphenated or not, or its slug. A suspension asks every run in flight it
  reaches to stop, in the transaction that writes it, so nothing goes on past its next request; a
  lift clears the column alone, the runs it stopped left for their member to resume
*/
async function suspendConversations(named: string, { isLift = false } = {}): Promise<SuspensionResult> {
  const target = await findTarget(named.trim())

  if (!target) return { outcome: 'missing' }

  if (isLift) {
    if (target.kind === 'account') await liftUserConversationsSuspension(dataConnect, { userId: target.id })
    else await liftOrganizationConversationsSuspension(dataConnect, { organizationId: target.id })

    return { outcome: 'lifted', target }
  }

  const { data } =
    target.kind === 'account'
      ? await suspendUserConversations(dataConnect, { userId: target.id })
      : await suspendOrganizationConversations(dataConnect, { organizationId: target.id })

  return { outcome: 'suspended', target, runCount: data.runs, subagentRunCount: data.subagentRuns }
}

async function findTarget(named: string): Promise<SuspensionTarget | null> {
  if (named.includes('@')) {
    // Lowercased, as Firebase writes every address it keeps
    const { data } = await getUserByEmail(dataConnect, { email: named.toLowerCase() })
    const [user] = data.users

    return user ? { kind: 'account', id: user.id, email: user.email } : null
  }

  if (UUID_PATTERN.test(named)) {
    const { data } = await getOrganizationById(dataConnect, { id: toCanonicalUuid(named) })

    return data.organization ? toOrganizationTarget(data.organization) : null
  }

  const { data } = await getOrganizationBySlug(dataConnect, { slug: named })
  const [organization] = data.organizations

  return organization ? toOrganizationTarget(organization) : null
}

function toOrganizationTarget(organization: { id: string; name: string; slug?: string | null }): SuspensionTarget {
  return {
    kind: 'organization',
    id: toCanonicalUuid(organization.id),
    name: organization.name,
    slug: organization.slug ?? null,
  }
}

export default suspendConversations
