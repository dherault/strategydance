import {
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
  launchSubagent as launchSubagentMutation,
} from 'strategydance-database/backend'

import type { ConversationContentBlock } from '~types'

import { dataConnect } from '~firebase'

import deriveUuid from '~utils/deriveUuid'

import buildConversationAttachmentBlock from '~domain/agent/buildConversationAttachmentBlock'
import enqueueRun from '~domain/conversations/enqueueRun'
import serializeTranscriptContent from '~domain/conversations/serializeTranscriptContent'
import measureSubagentLaunch from '~domain/subagents/measureSubagentLaunch'

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
  // The run and the call that launched it, which a launch from a script has neither of
  launchRunId?: string | null
  launchToolUseId?: string | null
}

export type LaunchSubagentResult =
  | { outcome: 'launched'; subagentId: string; runId: string }
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
  // A file it names is not one its parent sent
  | { outcome: 'attachmentsInvalid' }
  // Its first request, measured whole, would pass a send's budget
  | { outcome: 'overBudget'; reason: string }
  // Its id, derived from the launch, names a conversation that is not this launch's subagent
  | { outcome: 'conflict' }
  // The subagent and its run are stored, but the run could not be queued: it stays queued, and the
  // same launch sent again queues it again
  | { outcome: 'unavailable'; subagentId: string; runId: string }

/*
  Launches a subagent of one of the caller's conversations, its parent: a conversation of its own,
  hidden from the member, whose first entry is its brief, the files it hands over before the
  brief's text, each by its id in the Files API, and whose first run, queued, carries it out. Then
  the run is sent on its way, as a send's is. Each round reads where things stand first:

  - the subagent at the id the launch derives exists: the launch went through already, and is
    answered with it, its run queued again while it waits in the queue
  - the parent has to be the caller's, not deleted and no subagent, under its 100 subagents, and
    under 10 on its latest anchor, the member's action the launch carries out, those a retry deleted
    left out
  - each file it names has to be one its parent sent, never one waiting in a draft, whose prune
    would delete it under the subagent
  - with files, the subagent's first request, measured whole, has to fit a send's budget, so no
    subagent is full at its first request. A brief alone never comes near it

  The launch is one mutation, which takes the member's lock, then the parent's, and counts again
  under them. A write refused anyway, because a launch or a cascade got there in between, starts
  another round
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

    if (subagent) {
      if (subagent.userId !== userId || subagent.organizationId !== organizationId || subagent.parentId !== parentId) {
        return { outcome: 'conflict' }
      }

      const [run] = data.subagentRuns

      if (run?.status === ConversationRunStatus.QUEUED && !(await enqueueRun(reference, 'subagent-runs'))) {
        return { outcome: 'unavailable', subagentId, runId }
      }

      return { outcome: 'launched', subagentId, runId }
    }

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

    // A launch from no run, as a script makes one, carries out the member's latest action
    const anchorPosition = data.latestRuns[0]?.anchorPosition ?? 0

    if (
      data.subagents.filter(({ launchAnchorPosition }) => launchAnchorPosition === anchorPosition).length
      >= MAX_SUBAGENTS_PER_ACTION
    ) {
      return { outcome: 'tooManyOnAnchor' }
    }

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
      { type: 'text', text: input.brief },
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

    try {
      await launchSubagentMutation(dataConnect, {
        organizationId,
        userId,
        membershipCreatedAt: membership.createdAt,
        parentId,
        anchorPosition,
        launchRunId: input.launchRunId ?? null,
        launchToolUseId: input.launchToolUseId ?? null,
        conversationId: subagentId,
        title,
        runId,
        messageId: deriveUuid(subagentId, 'brief'),
        text,
        content: serializeTranscriptContent(content),
        attachmentIds,
      })
    } catch (error) {
      if (round === MAX_ROUNDS) throw error

      continue
    }

    if (!(await enqueueRun(reference, 'subagent-runs'))) return { outcome: 'unavailable', subagentId, runId }

    return { outcome: 'launched', subagentId, runId }
  }
}

export default launchSubagent
