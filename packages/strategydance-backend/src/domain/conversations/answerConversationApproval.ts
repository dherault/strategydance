import { buildConversationPreview } from 'strategydance-core'
import {
  ConversationApprovalState,
  ConversationRunStatus,
  ConversationToolStatus,
  answerConversationApproval as answerConversationApprovalMutation,
  getConversationApproval,
  getConversationTurnContext,
} from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import continueConversationRun from '~domain/conversations/continueConversationRun'
import {
  DENIED_CALL_RESULT,
  UNAPPROVED_CALL_RESULT,
  readFailedOutput,
  toFailedOutput,
} from '~domain/conversations/conversationToolResults'
import IntegrationCallChanged from '~domain/integrations/IntegrationCallChanged'
import readConversationIntegration from '~domain/integrations/readConversationIntegration'
import readIntegrationBinding from '~domain/integrations/readIntegrationBinding'

// How many times a decision reads where the conversation stands and tries, before it gives up
const MAX_ROUNDS = 4

type AnswerConversationApprovalInput = {
  // Canonical, as `toCanonicalUuid` writes them, and the caller's uid as the backend verified it
  organizationId: string
  userId: string
  conversationId: string
  messageId: string
  isAllowed: boolean
}

export type AnswerConversationApprovalResult =
  // The decision is recorded, denied instead when the server changed since the call was proposed,
  // and the run that carries the conversation on, once nothing waits and the caller may start one,
  // or null
  | { outcome: 'answered'; runId: string | null; isChanged: boolean }
  // The caller is no member of the organization
  | { outcome: 'forbidden' }
  // The conversation is somebody else's, deleted or a subagent, or holds no such approval
  | { outcome: 'missing' }
  // The approval was decided otherwise, or waits for nothing any more
  | { outcome: 'conflict' }
  // The decision is recorded and the run started, but it could not be queued: the same decision sent
  // again queues it again, as the page's reconcile does meanwhile
  | { outcome: 'unavailable' }

/*
  Records a member's Allow or Deny of a call of the turn their conversation waits on, then, once
  nothing of it waits, carries the conversation on, as an answer to a question does.

  An Allow holds only for the server, the tool and the account the call was proposed for: the
  server's revision, the tool's definition and the credential's generation are read again, and an
  Allow given after any of them changed is recorded as a denial saying so, which the model reads as
  a refusal it can propose again. The call itself checks them once more right before it is made.

  Each round reads where things stand first: a decision recorded already goes on to the continuation
  when it is the same one sent again, an Allow recorded as changed included, and is refused otherwise,
  as one on an approval a sent message denied, or that waits for nothing
*/
async function answerConversationApproval({
  organizationId,
  userId,
  conversationId,
  messageId,
  isAllowed,
}: AnswerConversationApprovalInput): Promise<AnswerConversationApprovalResult> {
  const reference = { organizationId, userId, conversationId }

  for (let round = 1; ; round++) {
    const [{ data }, { data: approvalData }] = await Promise.all([
      getConversationTurnContext(dataConnect, reference),
      getConversationApproval(dataConnect, { ...reference, messageId }),
    ])
    const { userOrganization: membership, conversation } = data
    const [approval] = approvalData.conversationMessages
    const [latest, previous] = data.latestRuns

    if (!membership) return { outcome: 'forbidden' }

    if (
      !conversation
      || conversation.userId !== userId
      || conversation.organizationId !== organizationId
      || conversation.deletedAt
      // A subagent is its parent's, never acted on by its member
      || conversation.parentId
      || !approval
    ) {
      return { outcome: 'missing' }
    }

    // The run that waits on the approval's turn, or waited until a continuation consumed it
    let waitingRunId: string | null = null
    let isChanged = false

    if (approval.answeredAt) {
      const recorded = readRecordedDecision(approval)

      if (recorded === 'unapproved' || (recorded === 'denied') === isAllowed) return { outcome: 'conflict' }

      isChanged = recorded === 'changed'

      if (latest?.status === ConversationRunStatus.WAITING) waitingRunId = latest.id
      else if (previous?.status === ConversationRunStatus.CONTINUED) waitingRunId = previous.id
    } else {
      if (!conversation.isAwaitingAnswer || latest?.status !== ConversationRunStatus.WAITING) {
        return { outcome: 'conflict' }
      }

      if (!conversation.previewMessageId) throw new Error(`Conversation ${conversationId} waits with no preview`)

      const name = approval.integrationName ?? 'The integration'

      isChanged =
        isAllowed
        && !(await isStillBound({ organizationId, userId, membershipCreatedAt: membership.createdAt }, approval))

      const decision = !isAllowed
        ? { approvalState: ConversationApprovalState.DENIED, reason: DENIED_CALL_RESULT }
        : isChanged
          ? { approvalState: ConversationApprovalState.DENIED, reason: new IntegrationCallChanged(name).message }
          : { approvalState: ConversationApprovalState.ALLOWED, reason: null }

      try {
        const { data: answered } = await answerConversationApprovalMutation(dataConnect, {
          ...reference,
          runId: latest.id,
          messageId,
          previewMessageId: conversation.previewMessageId,
          // The list's "Approval: …" follows the approval only while it shows it
          ...(conversation.previewMessageId === messageId
            ? {
                preview: buildConversationPreview({
                  kind: 'APPROVAL',
                  integrationName: approval.integrationName,
                  integrationToolName: approval.integrationToolName,
                  approvalState: decision.approvalState,
                  toolStatus: decision.reason ? ConversationToolStatus.FAILED : null,
                }),
              }
            : {}),
          approvalState: decision.approvalState,
          ...(decision.reason
            ? { toolStatus: ConversationToolStatus.FAILED, toolOutput: toFailedOutput(decision.reason) }
            : {}),
        })

        if (answered.left?.conversationMessages.length) return { outcome: 'answered', runId: null, isChanged }
      } catch (error) {
        if (round === MAX_ROUNDS) throw error

        continue
      }

      waitingRunId = latest.id
    }

    if (!waitingRunId) return { outcome: 'answered', runId: null, isChanged }

    const continued = await continueConversationRun({ ...reference, runId: waitingRunId })

    switch (continued.outcome) {
      case 'continued':
        return { outcome: 'answered', runId: continued.runId, isChanged }
      case 'unavailable':
        return { outcome: 'unavailable' }
      case 'missing':
        return { outcome: 'missing' }
      default:
        return { outcome: 'answered', runId: null, isChanged }
    }
  }
}

type StoredApproval = {
  approvalState?: ConversationApprovalState | null
  toolOutput?: string | null
}

/*
  What was decided on an approval already: allowed, denied by the member, denied because the server
  changed meanwhile, which only an Allow records, or not approved because the member sent a message
  instead, which no decision of theirs can change any more
*/
function readRecordedDecision({ approvalState, toolOutput }: StoredApproval) {
  if (approvalState === ConversationApprovalState.ALLOWED) return 'allowed'

  const reason = readFailedOutput(toolOutput ?? null)

  if (reason === DENIED_CALL_RESULT) return 'denied'
  if (reason === UNAPPROVED_CALL_RESULT) return 'unapproved'

  return 'changed'
}

type ApprovalBinding = {
  integrationId?: string | null
  integrationToolName?: string | null
  approvalConfigRevision?: number | null
  approvalToolHash?: string | null
  approvalCredentialGeneration?: string | null
}

// Whether the server, the tool and the account an approval was given for are the ones it would call
async function isStillBound(
  caller: { organizationId: string; userId: string; membershipCreatedAt: string },
  approval: ApprovalBinding,
) {
  if (!approval.integrationId || !approval.integrationToolName) return false

  const read = await readConversationIntegration(caller, approval.integrationId)

  if (read.outcome !== 'found') return false

  const binding = readIntegrationBinding(read.integration, read.connection, approval.integrationToolName)

  return (
    binding.configRevision === approval.approvalConfigRevision
    && binding.toolHash === approval.approvalToolHash
    && binding.credentialGeneration === (approval.approvalCredentialGeneration ?? null)
  )
}

export default answerConversationApproval
