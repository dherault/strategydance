import {
  ConversationRunStatus,
  ConversationRunTrigger,
  getSubagentLauncherForAgent,
} from 'strategydance-database/backend'

import type { ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

export type SubagentLauncherRead =
  // The run calling is still running and not asked to stop: a launch from it is made on its anchor,
  // unless it reacts to subagents' reports, which launches nothing, though it reads and stops
  | { outcome: 'running'; conversationId: string; runId: string; anchorPosition: number; isReaction: boolean }
  // The caller names no run calling, as everything but a worker that claimed one
  | { outcome: 'noLauncher' }
  // The caller is no longer the member the module was built for
  | { outcome: 'notMember' }
  // The run calling is a subagent's, which launches and reaches none
  | { outcome: 'fromSubagent' }
  // The run calling has ended or was asked to stop, its conversation deleted, or it is not the
  // caller's
  | { outcome: 'launcherEnded' }

/*
  The run calling the Subagents module, its launcher, read on the terms of its worker's fence, as
  every tool of the module reads it before anything else: still running, not asked to stop, and its
  conversation the caller's, no subagent and not deleted. A read takes no lock, so a launch and a
  stop check it again inside their mutations, which is what sees a Stop or a delete committing
  meanwhile
*/
async function readSubagentLauncher(caller: ModuleCaller): Promise<SubagentLauncherRead> {
  if (!caller.launcher) return { outcome: 'noLauncher' }

  const conversationId = toCanonicalUuid(caller.launcher.conversationId)
  const runId = toCanonicalUuid(caller.launcher.runId)
  const { data } = await getSubagentLauncherForAgent(dataConnect, {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
    conversationId,
    runId,
  })

  if (data.membership.length === 0) return { outcome: 'notMember' }

  const [run] = data.runs

  if (!run) return { outcome: 'launcherEnded' }
  if (run.conversation.parentId) return { outcome: 'fromSubagent' }
  if (run.status !== ConversationRunStatus.RUNNING || run.stopRequestedAt || run.conversation.deletedAt) {
    return { outcome: 'launcherEnded' }
  }

  return {
    outcome: 'running',
    conversationId,
    runId,
    anchorPosition: run.anchorPosition,
    isReaction: run.trigger === ConversationRunTrigger.REPORTS,
  }
}

export default readSubagentLauncher
