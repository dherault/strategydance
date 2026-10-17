import { ConversationRunTrigger, getSubagentLauncherForAgent } from 'strategydance-database/backend'

import type { ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

/*
  Whether a module's caller is a parent's run reacting to its subagents' reports, the run a worker
  claimed and named as its launcher: the first run no member started, which deletes nothing, so a
  deletion a report proposes, or text a subagent read asks for, waits for the member's word. Read by
  the deletes alone, whatever the run's status, since its trigger never changes, and loaded only by a
  call carrying a launcher, which no external agent's does
*/
async function isReactionCaller(caller: ModuleCaller) {
  if (!caller.launcher) return false

  const { data } = await getSubagentLauncherForAgent(dataConnect, {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
    conversationId: toCanonicalUuid(caller.launcher.conversationId),
    runId: toCanonicalUuid(caller.launcher.runId),
  })

  return data.runs[0]?.trigger === ConversationRunTrigger.REPORTS
}

export default isReactionCaller
