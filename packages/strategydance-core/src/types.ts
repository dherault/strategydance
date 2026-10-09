import type { MODULES } from './constants'

/*
  The envelope every backend response is wrapped in, success and failure alike. Declared here
  because the backend writes it and the web app reads it, and a copy on each side would drift
*/

export type ApiSuccessResponse<T = void> = {
  status: 'success'
  data?: T
}

export type ApiErrorResponse = {
  status: 'error'
  code: string
  message: string
}

export type ApiResponse<T = void> = ApiSuccessResponse<T> | ApiErrorResponse

/* ---
  ORGANIZATIONS
--- */

/*
  Why an address was not invited: taken by another invitation or a membership in the meantime,
  no room left in the team, the inviter no longer administering it, or a failure on the server's
  side
*/
export type InvitationFailureReason = 'taken' | 'full' | 'forbidden' | 'error'

// What inviting people to an organization answers with: who was invited, and who was not and why.
// Some can go out while others do not, since each address is inserted on its own
export type InviteOrganizationMembersData = {
  invitedEmails: string[]
  failedEmails: {
    email: string
    reason: InvitationFailureReason
  }[]
}

// Which of an organization's pictures a request is about
export type OrganizationImageKind = 'logo' | 'banner'

// What uploading or removing one of an organization's pictures answers with: its URL now, null
// once removed
export type ChangeOrganizationImageData = {
  url: string | null
}

// What uploading a picture for a document's text answers with: where it is downloaded from
export type RichTextImageData = {
  url: string
}

/*
  What a web page says of itself, as a link preview card in a document draws it: the address it
  was asked for, and whatever the page names of its title, its description, its site and its
  picture, each left out when it names none. A page that could not be read is its address alone
*/
export type LinkPreviewData = {
  url: string
  title?: string
  description?: string
  siteName?: string
  /** An https picture on the page's own site or elsewhere, which the card loads from there */
  imageUrl?: string
}

/* ---
  CONVERSATIONS
--- */

/*
  A conversation's entry, as `buildConversationPreview` reads it: the columns of a
  `ConversationMessage` row, by their names, so a row read back from the database goes in as it
  is. String literals rather than the schema's enums, which this package cannot import: the
  generated SDK's values are assignable to them, so a value the schema gains and these lack fails
  to typecheck wherever a row is passed
*/
export type ConversationPreviewSource = {
  kind: 'MEMBER_TEXT' | 'AGENT_TEXT' | 'TOOL_CALL' | 'QUESTION' | 'ASPECTS' | 'NOTE'
  text?: string | null
  toolName?: string | null
  toolStatus?: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | null
  questionPrompt?: string | null
  answerSelected?: string[] | null
  answerOther?: string | null
  isAnswerSkipped?: boolean | null
  noteKind?: 'STOPPED' | 'FAILED' | 'REFUSED' | 'INTERRUPTED' | 'FULL' | null
}

/*
  What `Conversation.preview` holds: the facts of the last entry the list shows, never its words.
  A text keeps up to `MAX_CONVERSATION_PREVIEW_LENGTH` characters of plain text, and a question
  its prompt, or once answered the answer
*/
export type ConversationPreview =
  | {
      kind: 'MEMBER_TEXT' | 'AGENT_TEXT'
      text: string
    }
  | {
      kind: 'TOOL_CALL'
      toolName: string
      toolStatus: NonNullable<ConversationPreviewSource['toolStatus']>
    }
  | {
      kind: 'QUESTION'
      questionState: 'WAITING' | 'ANSWERED' | 'SKIPPED'
      text: string
    }
  | {
      kind: 'NOTE'
      noteKind: NonNullable<ConversationPreviewSource['noteKind']>
    }

/*
  What `ConversationMessage.citations` holds on a reply that cites the web: each cited span, by its
  offsets in the message's `text`, with the sources web search gave for it, their address, title and
  the words quoted from them. The backend writes it as it draws the reply, and the thread draws a
  numbered link after each span and the sources under the reply
*/
export type ConversationCitation = {
  start: number
  end: number
  sources: {
    url: string
    title: string | null
    citedText: string
  }[]
}

// A member's answer to a question: the options they chose, by their text, and their own words
export type ConversationAnswer = {
  selected: string[]
  other: string | null
}

// Whether an answer fits its question, as `checkConversationAnswer` reads it: the answer as it is
// recorded, its options in the question's order and its own words trimmed, or why it does not
export type ConversationAnswerCheck =
  | { outcome: 'valid'; answer: ConversationAnswer }
  | { outcome: 'invalid'; reason: string }

// What answering a question answers with: the run that carries the conversation on once every
// question of its turn is answered, or null while another still waits, or while the member has as
// many runs going as they may, when the page's reconcile starts it later
export type AnswerConversationQuestionData = {
  runId: string | null
}

// What sending a message answers with: the run it started, or the one a send retried with the same
// message's id started the first time
export type SendConversationMessageData = {
  runId: string
}

// What resuming a stopped or interrupted run answers with: the run that carries it on, or the one a
// resume sent again started the first time
export type ResumeConversationRunData = {
  runId: string
}

// What retrying a run that ended with a note answers with: the run that answers its member's entry
// again, or the one a retry sent again started the first time, and the runs whose messages went,
// which the page drops from every page of the thread it holds
export type RetryConversationRunData = {
  runId: string
  removedRunIds: string[]
}

/*
  How much of the member's conversations a search covered:

  - `ALL`: every conversation whose title or one message holds every word
  - `BEST_MATCHES`: the most relevant matches, once the messages read ran out before the
    conversations did, when a narrower search finds the rest
  - `RECENT`: a search by substring, for Chinese or Japanese, which reads every title but only the
    messages of the most recently active conversations
*/
export type ConversationSearchCoverage = 'ALL' | 'BEST_MATCHES' | 'RECENT'

// What searching conversations answers with: the matching conversations' ids, in no particular
// order, since the page already holds the conversations and keeps its own, and how far it looked
export type SearchConversationsData = {
  conversationIds: string[]
  coverage: ConversationSearchCoverage
}

/* ---
  MODULES
--- */

// One of `MODULES`: what a module is called, where it is served, what MCP clients show for it, and
// the scopes a consent to it grants
export type ModuleDefinition = {
  readonly name: string
  readonly path: string
  readonly title: string
  readonly scopes: {
    readonly read: string
    readonly write: string
  }
}

// The name of one of `MODULES`
export type ModuleName = (typeof MODULES)[number]['name']

// A scope one of `MODULES` grants
export type ModuleScope = (typeof MODULES)[number]['scopes'][keyof ModuleDefinition['scopes']]
