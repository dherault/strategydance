import { randomUUID } from 'node:crypto'

import type { ModuleCall, ModuleCaller, SubagentsWriteResult } from '~types'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import launchSubagent, { type LaunchedSubagent } from '~domain/subagents/launchSubagent'

type LaunchSubagentForAgentInput = {
  title: string
  brief: string
  // Ids of files the calling conversation sent, as its member's entries name them
  attachments?: string[]
}

/*
  Launches a subagent of the calling conversation for the Subagents module's `launch_subagent`, from
  the run calling it, its launcher, as `launchSubagent` launches one: its id derived from the
  conversation's and the call's key, so a launch called again finds the same subagent, and is
  answered with what it answered then. A call without a key, which no agent of Strategy Dance's makes,
  launches a subagent each time. Answers its id and whether it was queued or left waiting for a slot,
  as its key keeps it, so a launch that found the five taken and promoted itself at once answers that
  it waits, the same as a call again: the reads say where it stands since
*/
async function launchSubagentForAgent(
  caller: ModuleCaller,
  { title, brief, attachments = [] }: LaunchSubagentForAgentInput,
  call: ModuleCall | null,
): Promise<SubagentsWriteResult<LaunchedSubagent>> {
  if (!caller.launcher) return { outcome: 'noLauncher' }

  const launched = await launchSubagent({
    organizationId: caller.organizationId,
    userId: caller.userId,
    parentId: toCanonicalUuid(caller.launcher.conversationId),
    key: call?.key ?? randomUUID(),
    title,
    brief,
    attachmentIds: attachments.map(toCanonicalUuid),
    module: { caller, call },
  })

  switch (launched.outcome) {
    case 'launched':
      return { outcome: 'written', result: launched.result }
    case 'answered':
    case 'keyConflict':
    case 'notMember':
    case 'fromSubagent':
    case 'fromReaction':
    case 'launcherEnded':
    case 'noLauncher':
    case 'invalid':
    case 'tooManyOnAnchor':
    case 'tooMany':
    case 'tooManyToday':
    case 'attachmentsInvalid':
    case 'overBudget':
      return launched
    case 'forbidden':
      return { outcome: 'notMember' }
    // Its parent, the conversation calling, went or is a subagent since the launcher was read
    case 'missing':
      return { outcome: 'launcherEnded' }
    // Its id, derived from the key, names a conversation that is not this launch's subagent
    case 'conflict':
      return { outcome: 'keyConflict' }
    case 'unavailable':
      return { outcome: 'unavailable' }
  }
}

export default launchSubagentForAgent
