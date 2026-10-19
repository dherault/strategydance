import {
  MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER,
  MAX_CONVERSATION_ATTACHMENTS_PER_MESSAGE,
  MAX_CONVERSATION_SEND_INPUT_TOKENS,
  MAX_CONVERSATION_SUBAGENTS,
  MAX_CONVERSATION_TITLE_LENGTH,
  MAX_SUBAGENTS_PER_ACTION,
  MAX_SUBAGENT_BRIEF_LENGTH,
} from 'strategydance-core'
import {
  ConversationAttachmentStatus,
  ConversationRunStatus,
  getSubagentLaunchContext,
  launchPendingSubagent,
  launchPendingSubagentForAgent,
  launchSubagentForAgent,
  launchSubagent as launchSubagentMutation,
} from 'strategydance-database/backend'

import type { ConversationContentBlock, ModuleCall, ModuleCaller, ReachedUsageCap, SubagentStatus } from '~types'

import { IS_USAGE_CAPPED } from '~constants'

import { dataConnect } from '~firebase'

import deriveUuid from '~utils/deriveUuid'
import logger from '~utils/logger'

import buildConversationAttachmentBlock from '~domain/agent/buildConversationAttachmentBlock'
import enqueueRun from '~domain/conversations/enqueueRun'
import finalizeDeadConversationRuns from '~domain/conversations/finalizeDeadConversationRuns'
import readReachedUsageCap from '~domain/conversations/readReachedUsageCap'
import serializeTranscriptContent from '~domain/conversations/serializeTranscriptContent'
import answerFromModuleCall from '~domain/modules/answerFromModuleCall'
import isModuleCallKeyTaken from '~domain/modules/isModuleCallKeyTaken'
import toModuleCallVariables from '~domain/modules/toModuleCallVariables'
import measureSubagentLaunch from '~domain/subagents/measureSubagentLaunch'
import promoteSubagentRuns from '~domain/subagents/promoteSubagentRuns'
import readSubagentLauncher from '~domain/subagents/readSubagentLauncher'

// How many times a launch reads where its parent stands and tries, before it gives up
const MAX_ROUNDS = 4

type LaunchSubagentInput = {
  // Canonical, as `toCanonicalUuid` writes them, and the caller's uid as the backend verified it
  organizationId: string
  userId: string
  parentId: string
  // What makes the launch itself, so a launch sent again finds the subagent it made: Claude's id for
  // the call that launched it, or a script's own
  key: string
  // One line of at most 120 characters, and the brief, all the subagent knows of its parent's
  // conversation, at most 20000
  title: string
  brief: string
  // The files of the parent's it hands over, canonical and each once, at most 10, in the order the
  // subagent reads them
  attachmentIds: string[]
  // A launch through the Subagents module: its caller, whose launcher is the run launching it, which
  // the launch is made on the anchor of and checks is still running, and its call, whose key keeps
  // what it answered and is the call's id the subagent records. A launch from a script has none,
  // and is made on its parent's latest anchor
  module?: { caller: ModuleCaller; call: ModuleCall | null }
}

// What a launch through the Subagents module keeps under its key, and answers when called again
export type LaunchedSubagent = {
  id: string
  title: string
  status: Extract<SubagentStatus, 'QUEUED' | 'WAITING_FOR_SLOT'>
}

export type LaunchSubagentResult =
  // Its run queued, or waiting for one of the member's five subagent slots, and what the launch
  // answers, its run as it was inserted, which a launch through the module keeps under its key, so
  // its answer and a call again's agree whatever a promotion did since
  | { outcome: 'launched'; subagentId: string; runId: string; isPending: boolean; result: LaunchedSubagent }
  // The caller is no member of the organization
  | { outcome: 'forbidden' }
  // The parent is not the caller's, is deleted, or is a subagent, which launches none
  | { outcome: 'missing' }
  // Its title is not one line of at most 120 characters, its brief is empty or longer than 20000, or
  // it names more than 10 files
  | { outcome: 'invalid'; reason: string }
  // Its parent launched 10 on its anchor already, or holds 100
  | { outcome: 'tooManyOnAnchor' }
  | { outcome: 'tooMany' }
  // The member launched 30 in the organization in the last 24 hours, or the account 60 across its
  // organizations, or a daily spend ceiling is reached
  | { outcome: 'tooManyToday'; cap: ReachedUsageCap }
  // A file it names is not one its parent sent
  | { outcome: 'attachmentsInvalid' }
  // Staff suspended the member's conversations, or the organization's
  | { outcome: 'suspended' }
  // Its first request, measured whole, would pass a send's budget
  | { outcome: 'overBudget'; reason: string }
  // Its id, derived from the launch, names a conversation that is not this launch's subagent
  | { outcome: 'conflict' }
  // The subagent and its run are stored, but the run could not be queued: it stays queued, and the
  // same launch sent again queues it again
  | { outcome: 'unavailable'; subagentId: string; runId: string }
  // A launch through the module that its key made before, answered with what it answered then, or
  // a key sent before with another call, or by a caller who is no longer the member
  | { outcome: 'answered'; result: unknown }
  | { outcome: 'keyConflict' }
  | { outcome: 'notMember' }
  // A launch through the module from a subagent's run, which launches none, from a parent's reaction
  // to its subagents' reports, which launches none either, or from a run that has ended or was asked
  // to stop
  | { outcome: 'fromSubagent' }
  | { outcome: 'fromReaction' }
  | { outcome: 'launcherEnded' }
  | { outcome: 'noLauncher' }

/*
  Launches a subagent of one of the caller's conversations, its parent: a conversation of its own,
  hidden from the member, whose first entry is its brief, the files it hands over before the
  brief's text, each by its id in the Files API, and whose first run, queued, carries it out. Then
  the run is sent on its way, as a send's is. Each round reads where things stand first:

  - the subagent at the id the launch derives exists: the launch went through already, and is
    answered with it, its run queued again while it waits in the queue, or promoted while it waits
    for a slot, as the launch that left it pending would have
  - the parent has to be the caller's, not deleted and no subagent, under its 100 subagents, and
    under 10 on its latest anchor, the member's action the launch carries out, those a retry deleted
    left out
  - the member may not have launched 30 subagents in the organization in the last 24 hours, nor the
    account 60 across its organizations, the daily caps a deleted subagent still counts toward, nor
    have reached a daily spend ceiling
  - each file it names has to be one its parent sent, never one waiting in a draft, whose prune
    would delete it under the subagent
  - with files, the subagent's first request, measured whole, has to fit a send's budget, so no
    subagent is full at its first request. A brief alone never comes near it
  - a subagent run of the member's past its lease, under any parent, died with its worker and holds
    one of their five slots: it is finalized first, with its report, the oldest run waiting
    promoted into its slot, and the slots read again

  A launch through the Subagents module reads besides what its key keeps, answering a launch called
  again with what it answered then, once its subagent is queued again as above, and launching
  nothing when its subagent was pruned since, and the run launching it, which has to be still
  running, not asked to stop, no subagent's and no reaction to subagents' reports, and whose anchor it
  is made on.

  The launch is one mutation, which takes the member's lock, then the parent's, and counts again
  under them, the module's checking the run launching it again after both, and storing what its key
  keeps. Its run is queued into one of the member's five subagent slots in the organization, or,
  with all five taken as the launch read them, waits pending for one, and the launch promotes right
  after, so a slot freed meanwhile goes to the oldest run waiting. A write refused anyway, because a
  launch, an end or a cascade got there in between, starts another round
*/
async function launchSubagent(input: LaunchSubagentInput): Promise<LaunchSubagentResult> {
  const { organizationId, userId, parentId, attachmentIds } = input
  // Postgres refuses U+0000 in any text, and the thread draws the brief as prose
  const title = input.title.replaceAll('\u0000', '')
  const text = input.brief.replaceAll('\u0000', '')

  if (!title.trim() || /[\r\n]/.test(title) || [...title].length > MAX_CONVERSATION_TITLE_LENGTH) {
    return { outcome: 'invalid', reason: `A title is one line of at most ${MAX_CONVERSATION_TITLE_LENGTH} characters` }
  }

  if (!text.trim() || [...text].length > MAX_SUBAGENT_BRIEF_LENGTH) {
    return { outcome: 'invalid', reason: `A brief holds 1 to ${MAX_SUBAGENT_BRIEF_LENGTH} characters` }
  }

  if (
    attachmentIds.length > MAX_CONVERSATION_ATTACHMENTS_PER_MESSAGE
    || new Set(attachmentIds).size < attachmentIds.length
  ) {
    return {
      outcome: 'invalid',
      reason: `A subagent is handed at most ${MAX_CONVERSATION_ATTACHMENTS_PER_MESSAGE} files, each once`,
    }
  }

  const subagentId = deriveUuid(parentId, 'subagent', input.key)
  const runId = deriveUuid(subagentId, 'launch')
  const reference = { organizationId, userId, conversationId: subagentId, runId }

  for (let round = 1; ; round++) {
    const { data } = await getSubagentLaunchContext(dataConnect, {
      organizationId,
      userId,
      parentId,
      subagentId,
      attachmentIds,
    })
    const { userOrganization: membership, parent, subagent } = data

    if (!membership) return { outcome: 'forbidden' }

    const stored = input.module ? await answerFromModuleCall(input.module.caller, input.module.call) : null

    if (stored && stored.outcome !== 'answered') return stored

    if (subagent) {
      if (subagent.userId !== userId || subagent.organizationId !== organizationId || subagent.parentId !== parentId) {
        return { outcome: 'conflict' }
      }

      const [run] = data.subagentRuns

      if (run?.status === ConversationRunStatus.QUEUED && !(await enqueueRun(reference, 'subagent-runs'))) {
        return { outcome: 'unavailable', subagentId, runId }
      }

      // A pending launch whose answer was lost has not promoted yet, as the launch it repeats would
      if (run?.status === ConversationRunStatus.PENDING) {
        const promoted = await promote(input)

        if (stored) return stored

        return {
          outcome: 'launched',
          subagentId,
          runId,
          isPending: !promoted.some(queued => queued.runId === runId),
          result: { id: subagentId, title, status: 'WAITING_FOR_SLOT' },
        }
      }

      if (stored) return stored

      return {
        outcome: 'launched',
        subagentId,
        runId,
        isPending: false,
        result: { id: subagentId, title, status: 'QUEUED' },
      }
    }

    // Its subagent was pruned since, which a launch called again never makes anew
    if (stored) return stored

    // Read before the launcher, which the suspension asked to stop: no run of theirs would be claimed
    if (data.user?.conversationsSuspendedAt || data.organization?.conversationsSuspendedAt) {
      return { outcome: 'suspended' }
    }

    const launcher = input.module ? await readSubagentLauncher(input.module.caller) : null

    if (launcher && launcher.outcome !== 'running') return launcher
    // Checked again inside the mutation, which refuses a reaction's run however it was read
    if (launcher?.isReaction) return { outcome: 'fromReaction' }

    if (
      !parent
      || parent.userId !== userId
      || parent.organizationId !== organizationId
      || parent.deletedAt
      || parent.parentId
    ) {
      return { outcome: 'missing' }
    }

    if (parent.subagentCount >= MAX_CONVERSATION_SUBAGENTS) return { outcome: 'tooMany' }

    // Read again once one has ended, which freed a slot the oldest run waiting takes first
    if (round < MAX_ROUNDS && (await finalizeDeadConversationRuns(input, data.activeSubagentRuns, 'subagent-runs'))) {
      await promote(input)

      continue
    }

    // A launch from no run, as a script makes one, carries out the member's latest action
    const anchorPosition = launcher?.anchorPosition ?? data.latestRuns[0]?.anchorPosition ?? 0

    if (
      data.subagents.filter(({ launchAnchorPosition }) => launchAnchorPosition === anchorPosition).length
      >= MAX_SUBAGENTS_PER_ACTION
    ) {
      return { outcome: 'tooManyOnAnchor' }
    }

    // Counted before anything is stored, and again by the mutation, whose refusal reads them again
    const cap = await readReachedUsageCap(input, ['subagents', 'spend'], { isSubagent: true })

    if (cap) return { outcome: 'tooManyToday', cap }

    const files = []

    for (const attachmentId of attachmentIds) {
      const file = data.files.find(({ id }) => id === attachmentId)

      if (
        !file
        || file.status !== ConversationAttachmentStatus.READY
        || !file.messageId
        || !file.claudeFileId
        || typeof file.tokenCount !== 'number'
      ) {
        return { outcome: 'attachmentsInvalid' }
      }

      files.push({ ...file, claudeFileId: file.claudeFileId, tokenCount: file.tokenCount })
    }

    const content: ConversationContentBlock[] = [
      ...files.map(file => buildConversationAttachmentBlock(file, { fileId: file.claudeFileId })),
      // As stored, without U+0000, so the transcript and its measure hold what the thread draws
      { type: 'text', text },
    ]

    if (files.length) {
      const inputTokens = await measureSubagentLaunch({
        organizationId,
        userId,
        parentId,
        subagentId,
        membershipCreatedAt: membership.createdAt,
        content,
        files,
      })

      if (inputTokens > MAX_CONVERSATION_SEND_INPUT_TOKENS) {
        return {
          outcome: 'overBudget',
          reason: `The subagent's first request would take ${inputTokens} input tokens with these files, past ${MAX_CONVERSATION_SEND_INPUT_TOKENS}`,
        }
      }
    }

    const isPending = data.activeSubagentRuns.length >= MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER
    const variables = {
      organizationId,
      userId,
      membershipCreatedAt: membership.createdAt,
      parentId,
      anchorPosition,
      conversationId: subagentId,
      title,
      runId,
      messageId: deriveUuid(subagentId, 'brief'),
      text,
      content: serializeTranscriptContent(content),
      attachmentIds,
      isUsageCapped: IS_USAGE_CAPPED,
    }

    const result: LaunchedSubagent = { id: subagentId, title, status: isPending ? 'WAITING_FOR_SLOT' : 'QUEUED' }

    try {
      if (input.module && launcher) {
        const { caller, call } = input.module

        await (isPending ? launchPendingSubagentForAgent : launchSubagentForAgent)(dataConnect, {
          ...variables,
          launchRunId: launcher.runId,
          launchToolUseId: call?.key ?? null,
          ...toModuleCallVariables(caller, call, result),
        })
      } else {
        await (isPending ? launchPendingSubagent : launchSubagentMutation)(dataConnect, {
          ...variables,
          launchRunId: null,
          launchToolUseId: null,
        })
      }
    } catch (error) {
      // A key taken meanwhile is answered from it at the next round, one past the last if need be
      const isKeyTaken = Boolean(input.module) && isModuleCallKeyTaken(error)

      if (round > MAX_ROUNDS || (round === MAX_ROUNDS && !isKeyTaken)) throw error

      continue
    }

    if (isPending) {
      const promoted = await promote(input)

      return { outcome: 'launched', subagentId, runId, isPending: !promoted.some(run => run.runId === runId), result }
    }

    if (!(await enqueueRun(reference, 'subagent-runs'))) return { outcome: 'unavailable', subagentId, runId }

    return { outcome: 'launched', subagentId, runId, isPending: false, result }
  }
}

// Promotes the member's oldest runs waiting into their free slots, answering those it promoted: one
// that fails leaves them to the reconcile, and the launch stands
async function promote(member: { organizationId: string; userId: string }) {
  try {
    return await promoteSubagentRuns(member)
  } catch (error) {
    logger.warn(`Subagent runs of ${member.userId}: a launch could not promote into the free slots`, error)

    return []
  }
}

export default launchSubagent
