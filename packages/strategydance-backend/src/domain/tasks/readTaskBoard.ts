import { getTaskBoardForAgent } from 'strategydance-database/backend'

import type { ModuleCaller, TaskBoard } from '~types'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

type ReadTaskBoardResult = { outcome: 'notMember' } | { outcome: 'read'; board: TaskBoard }

/*
  The live board and the team, as every tool of the Tasks module reads them: each task without its
  description, with the ids of the live tasks it waits on, and the members by when they joined. A
  caller who is no longer the member the module read is refused rather than shown an empty board.
  Ids are dashless, as Data Connect writes them
*/
async function readTaskBoard(caller: ModuleCaller): Promise<ReadTaskBoardResult> {
  const { data } = await getTaskBoardForAgent(dataConnect, {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
  })

  if (data.membership.length === 0) return { outcome: 'notMember' }

  return {
    outcome: 'read',
    board: {
      tasks: data.tasks.map(task => ({
        id: toCanonicalUuid(task.id),
        name: task.name,
        status: task.status,
        position: task.position,
        assigneeId: task.assigneeId ?? null,
        isAssignedToAgent: task.isAssignedToAgent,
        dueDate: task.dueDate ?? null,
        aspects: task.aspects,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        dependencyIds: task.dependencies.map(({ dependencyId }) => toCanonicalUuid(dependencyId)),
        linkCount: task.linkCount[0]?._count ?? 0,
      })),
      members: data.members.map(member => ({ id: member.userId, name: member.user.displayName ?? null })),
    },
  }
}

export default readTaskBoard
