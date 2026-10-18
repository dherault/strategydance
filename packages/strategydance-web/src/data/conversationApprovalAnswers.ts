import createTabStore from '~utils/common/createTabStore'

// A decision on a call waiting for the reader's approval, as they have it under way
export type ConversationApprovalAnswerDraft = {
  // The decision being sent, which no other view of the approval may race, or null
  sending: 'allow' | 'deny' | null
  // Whether an Allow sent was denied because the server changed since the call was proposed, which
  // the decided call goes on saying once the approval has made way for it
  isChanged: boolean
}

export const EMPTY_CONVERSATION_APPROVAL_ANSWER: ConversationApprovalAnswerDraft = { sending: null, isChanged: false }

/*
  The decisions the reader has under way, kept for the life of the tab by approval, so an approval
  drawn again, its conversation moved between its page and the dock or its window minimized, waits
  on a decision still being sent, as a question's answer does. Kept by
  `${userId}:${organizationId}:${messageId}`, which `useConversationApprovalAnswer` makes
*/
const answers = createTabStore(
  EMPTY_CONVERSATION_APPROVAL_ANSWER,
  ({ sending, isChanged }) => sending === null && !isChanged,
)

export const readConversationApprovalAnswer = answers.read

export const updateConversationApprovalAnswer = answers.update

export const subscribeToConversationApprovalAnswers = answers.subscribe
