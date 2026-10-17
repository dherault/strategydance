import { listSubagentsForAgent } from 'strategydance-database/backend'
import { z } from 'zod'

import type { ModuleCaller, SubagentStatus, SubagentsRefusal } from '~types'

import { dataConnect } from '~firebase'

import decodeCursor from '~utils/decodeCursor'
import encodeCursor from '~utils/encodeCursor'
import toCanonicalUuid from '~utils/toCanonicalUuid'

import readSubagentLauncher from '~domain/subagents/readSubagentLauncher'
import toSubagentStatus from '~domain/subagents/toSubagentStatus'

// How many subagents a page holds
const PAGE_SIZE = 20

// What a cursor holds: the last subagent's place, newest first, which the next page starts after
const cursorSchema = z.object({ createdAt: z.string(), id: z.string() })

// A subagent as the list shows it
export type ListedSubagent = {
  id: string
  title: string
  status: SubagentStatus
  startedAt: string
  // When its last run ended, which its report is written at however it ended
  endedAt: string | null
  hasReport: boolean
}

export type ListSubagentsResult = { outcome: 'listed'; subagents: ListedSubagent[]; cursor?: string } | SubagentsRefusal

/*
  The subagents the calling conversation launched, those a retry deleted left out, since the run that
  launched them is cut from the transcript and the agent knows nothing of them: newest first and then
  by id, 20 a page, with a cursor while more remain. A conversation holds at most 100, so the page is
  cut from every one, and a subagent launched while the agent pages shows on no page after the first
*/
async function listSubagents(caller: ModuleCaller, { cursor }: { cursor?: string }): Promise<ListSubagentsResult> {
  const after = cursor === undefined ? null : decodeCursor(cursor, cursorSchema)

  if (cursor !== undefined && !after) return { outcome: 'invalidCursor' }

  const launcher = await readSubagentLauncher(caller)

  if (launcher.outcome !== 'running') return launcher

  const { data } = await listSubagentsForAgent(dataConnect, {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
    parentId: launcher.conversationId,
  })

  if (data.membership.length === 0) return { outcome: 'notMember' }

  const remaining = after
    ? data.subagents.filter(
        ({ createdAt, id }) =>
          createdAt < after.createdAt || (createdAt === after.createdAt && toCanonicalUuid(id) > after.id),
      )
    : data.subagents
  const page = remaining.slice(0, PAGE_SIZE)
  const last = page.at(-1)

  return {
    outcome: 'listed',
    subagents: page.map(subagent => ({
      id: toCanonicalUuid(subagent.id),
      title: subagent.title,
      // A subagent and its first run are made in one mutation, so it has one
      status: toSubagentStatus(subagent.latestRuns[0]!.status),
      startedAt: subagent.createdAt,
      endedAt: subagent.reportedAt ?? null,
      hasReport: Boolean(subagent.reportedAt),
    })),
    ...(last
      && remaining.length > PAGE_SIZE && {
        cursor: encodeCursor({ createdAt: last.createdAt, id: toCanonicalUuid(last.id) }),
      }),
  }
}

export default listSubagents
