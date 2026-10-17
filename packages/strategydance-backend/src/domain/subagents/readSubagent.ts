import { getSubagentForAgent, getSubagentWritesForAgent } from 'strategydance-database/backend'
import { z } from 'zod'

import type { ModuleCaller, SubagentStatus, SubagentsRefusal } from '~types'

import { dataConnect } from '~firebase'

import decodeCursor from '~utils/decodeCursor'
import encodeCursor from '~utils/encodeCursor'
import toCanonicalUuid from '~utils/toCanonicalUuid'

import toConversationModuleScope from '~domain/agent/toConversationModuleScope'
import readSubagentLauncher from '~domain/subagents/readSubagentLauncher'
import toSubagentStatus from '~domain/subagents/toSubagentStatus'
import toSubagentWrite, { type SubagentWrite } from '~domain/subagents/toSubagentWrite'

// How many writes a page holds: a chain of four runs makes up to 200 calls
const PAGE_SIZE = 50

// The instant the first page reads past, before anything was written
const FIRST_PAGE_AFTER = '1970-01-01T00:00:00Z'

// What a cursor holds: the last write's place, oldest first, which the next page starts after
const cursorSchema = z.object({ createdAt: z.string(), key: z.string() })

// A subagent as `read_subagent` reads it, with a page of what it wrote
export type ReadSubagent = {
  id: string
  title: string
  status: SubagentStatus
  // What it is doing now, the latest progress line of a working run
  step: string | null
  runs: number
  startedAt: string
  endedAt: string | null
  report: string | null
  writes: SubagentWrite[]
  total: number
  cursor?: string
}

export type ReadSubagentResult = { outcome: 'read'; subagent: ReadSubagent } | SubagentsRefusal

/*
  One subagent of the calling conversation: where it stands, its step while it works, how many runs
  its chain took, its report once written, and what it wrote, oldest first, 50 a page, with `total`
  and a cursor while more remain, the rest coming with every page. What it wrote is what its
  successful module writes keep under its idempotency scope: every write of an agent carries a key,
  and only a write that went through keeps one. A subagent of another conversation, somebody else's,
  or one a retry deleted, whose launch the transcript no longer holds, reads as one that does not
  exist
*/
async function readSubagent(
  caller: ModuleCaller,
  { id, cursor }: { id: string; cursor?: string },
): Promise<ReadSubagentResult> {
  const after = cursor === undefined ? null : decodeCursor(cursor, cursorSchema)

  if (cursor !== undefined && !after) return { outcome: 'invalidCursor' }

  const launcher = await readSubagentLauncher(caller)

  if (launcher.outcome !== 'running') return launcher

  const subagentId = toCanonicalUuid(id)
  const member = {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
  }
  const { data } = await getSubagentForAgent(dataConnect, {
    ...member,
    parentId: launcher.conversationId,
    id: subagentId,
  })

  if (data.membership.length === 0) return { outcome: 'notMember' }

  const [subagent] = data.subagents
  const [run] = subagent?.latestRuns ?? []

  if (!subagent || !run) return { outcome: 'notFound' }

  const { data: written } = await getSubagentWritesForAgent(dataConnect, {
    ...member,
    scope: toConversationModuleScope(subagentId),
    afterCreatedAt: after?.createdAt ?? FIRST_PAGE_AFTER,
    afterKey: after?.key ?? '',
  })

  if (written.membership.length === 0) return { outcome: 'notMember' }

  const page = written.writes.slice(0, PAGE_SIZE)
  const last = page.at(-1)
  const status = toSubagentStatus(run.status)

  return {
    outcome: 'read',
    subagent: {
      id: toCanonicalUuid(subagent.id),
      title: subagent.title,
      status,
      step: status === 'WORKING' ? (run.step ?? null) : null,
      runs: subagent.runCount[0]?._count ?? 0,
      startedAt: subagent.createdAt,
      endedAt: subagent.reportedAt ?? null,
      report: subagent.report ?? null,
      writes: page.map(toSubagentWrite),
      total: written.total[0]?._count ?? 0,
      ...(last
        && written.writes.length > PAGE_SIZE && {
          cursor: encodeCursor({ createdAt: last.createdAt, key: last.idempotencyKey }),
        }),
    },
  }
}

export default readSubagent
