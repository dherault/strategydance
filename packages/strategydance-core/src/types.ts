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
