import { type ConversationAnswer, buildConversationPreview, checkConversationAnswer } from 'strategydance-core'
import {
  ConversationMessageKind,
  ConversationRunStatus,
  answerConversationQuestion as answerConversationQuestionMutation,
  getConversationQuestion,
  getConversationTurnContext,
} from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import continueConversationRun from '~domain/conversations/continueConversationRun'

// How many times an answer reads where the conversation stands and tries, before it gives up
const MAX_ROUNDS = 4

type AnswerConversationQuestionInput = {
  // Canonical, as `toCanonicalUuid` writes them, and the caller's uid as the backend verified it
  organizationId: string
  userId: string
  conversationId: string
  messageId: string
  answer: ConversationAnswer
}

export type AnswerConversationQuestionResult =
  // The answer is recorded, and the run that carries the conversation on, once none waits and the
  // caller may start one, or null
  | { outcome: 'answered'; runId: string | null }
  // The caller is no member of the organization
  | { outcome: 'forbidden' }
  // The conversation is somebody else's, or deleted, or holds no such question
  | { outcome: 'missing' }
  // The answer does not fit the question
  | { outcome: 'invalid'; reason: string }
  // The question was skipped, answered otherwise, or waits for nothing any more
  | { outcome: 'conflict' }
  // The answer is recorded and the run started, but it could not be queued: the same answer sent
  // again queues it again, as the page's reconcile does meanwhile
  | { outcome: 'unavailable' }

/*
  Records a member's answer to a question of the turn their conversation waits on, then, once no
  question of it waits, carries the conversation on. The answer is checked against its question
  before anything is recorded, since it goes into what Claude is sent. Each round reads where things
  stand first:

  - the question answered already: the same answer sent again goes on to the continuation, which
    finishes what its first try did not, and another answer is refused, as is an answer to a question
    skipped, or that waits for nothing, its turn stopped or gone
  - then the answer is recorded under the conversation's lock, which says how many questions still
    wait: none, and the conversation is carried on

  A write refused anyway, because another answer or a send got there in between, starts another
  round
*/
async function answerConversationQuestion({
  organizationId,
  userId,
  conversationId,
  messageId,
  answer,
}: AnswerConversationQuestionInput): Promise<AnswerConversationQuestionResult> {
  const reference = { organizationId, userId, conversationId }

  for (let round = 1; ; round++) {
    const [{ data }, { data: questionData }] = await Promise.all([
      getConversationTurnContext(dataConnect, reference),
      getConversationQuestion(dataConnect, { ...reference, messageId }),
    ])
    const { userOrganization: membership, conversation } = data
    const [question] = questionData.conversationMessages
    const [latest, previous] = data.latestRuns

    if (!membership) return { outcome: 'forbidden' }

    if (
      !conversation
      || conversation.userId !== userId
      || conversation.organizationId !== organizationId
      || conversation.deletedAt
      || question?.kind !== ConversationMessageKind.QUESTION
    ) {
      return { outcome: 'missing' }
    }

    const checked = checkConversationAnswer(
      { options: question.questionOptions ?? [], isMultipleChoice: question.isMultipleChoice ?? false },
      answer,
    )

    if (checked.outcome === 'invalid') return checked
    if (question.isAnswerSkipped) return { outcome: 'conflict' }

    // The run that waits on the question's turn, or waited until a continuation consumed it
    let waitingRunId: string | null = null

    if (question.answeredAt) {
      if (!isSameAnswer(question, checked.answer)) return { outcome: 'conflict' }

      if (latest?.status === ConversationRunStatus.WAITING) waitingRunId = latest.id
      else if (previous?.status === ConversationRunStatus.CONTINUED) waitingRunId = previous.id
    } else {
      if (!conversation.isAwaitingAnswer || latest?.status !== ConversationRunStatus.WAITING) {
        return { outcome: 'conflict' }
      }

      if (!conversation.previewMessageId) throw new Error(`Conversation ${conversationId} waits with no preview`)

      try {
        const { data: answered } = await answerConversationQuestionMutation(dataConnect, {
          ...reference,
          runId: latest.id,
          messageId,
          previewMessageId: conversation.previewMessageId,
          // The list's "Question: …" turns into "Answered: …" only for the question it shows
          ...(conversation.previewMessageId === messageId
            ? {
                preview: buildConversationPreview({
                  kind: 'QUESTION',
                  questionPrompt: question.questionPrompt,
                  answerSelected: checked.answer.selected,
                  answerOther: checked.answer.other,
                }),
              }
            : {}),
          answerSelected: checked.answer.selected,
          ...(checked.answer.other ? { answerOther: checked.answer.other } : {}),
        })

        if (answered.left?.conversationMessages.length) return { outcome: 'answered', runId: null }
      } catch (error) {
        if (round === MAX_ROUNDS) throw error

        continue
      }

      waitingRunId = latest.id
    }

    if (!waitingRunId) return { outcome: 'answered', runId: null }

    const continued = await continueConversationRun({ ...reference, runId: waitingRunId })

    switch (continued.outcome) {
      case 'continued':
        return { outcome: 'answered', runId: continued.runId }
      case 'unavailable':
        return { outcome: 'unavailable' }
      case 'missing':
        return { outcome: 'missing' }
      default:
        return { outcome: 'answered', runId: null }
    }
  }
}

// Whether the answer recorded is this one, its options in the question's order and its own words
// trimmed, as both are recorded
function isSameAnswer(
  recorded: { answerSelected?: string[] | null; answerOther?: string | null },
  answer: ConversationAnswer,
) {
  const selected = recorded.answerSelected ?? []

  return (
    selected.length === answer.selected.length
    && selected.every((option, index) => option === answer.selected[index])
    && (recorded.answerOther ?? null) === answer.other
  )
}

export default answerConversationQuestion
