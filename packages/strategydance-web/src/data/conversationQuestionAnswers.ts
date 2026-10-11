import createTabStore from '~utils/common/createTabStore'

// An answer to one of Strategy Dance's questions, as the reader has it under way
export type ConversationQuestionAnswerDraft = {
  // The options chosen, in the question's order
  selected: string[]
  // Whether the answer in the reader's own words is chosen, and those words
  isOtherChosen: boolean
  other: string
  // Whether the answer is being sent, which no other view of the question may race
  isSending: boolean
}

export const EMPTY_CONVERSATION_QUESTION_ANSWER: ConversationQuestionAnswerDraft = {
  selected: [],
  isOtherChosen: false,
  other: '',
  isSending: false,
}

/*
  The answers the reader has under way, kept for the life of the tab by question, so a question
  drawn again, its conversation moved between its page and the dock, its window minimized or held
  by the "+N" menu, shows the options chosen and the words written, and waits on an answer still
  being sent. Kept by
  `${userId}:${organizationId}:${messageId}`, which `useConversationQuestionAnswer` makes, as the
  composer's message is
*/
const answers = createTabStore(
  EMPTY_CONVERSATION_QUESTION_ANSWER,
  ({ selected, isOtherChosen, other, isSending }) => !selected.length && !isOtherChosen && !other && !isSending,
)

export const readConversationQuestionAnswer = answers.read

export const updateConversationQuestionAnswer = answers.update

export const subscribeToConversationQuestionAnswers = answers.subscribe
