export type { ApiErrorResponse, ApiResponse, ApiSuccessResponse } from 'strategydance-core'

/* ---
  REQUEST AUGMENTATION
--- */

// Who is calling, as their verified ID token says
export type Viewer = {
  id: string
  email: string | null
}

declare module 'express' {
  interface Request {
    // Set by `authenticationMiddleware`, and only by it
    viewer?: Viewer
  }
}

/* ---
  CONVERSATIONS
--- */

/*
  A content block of a conversation's transcript, as Claude's API writes and reads one: its type,
  and whatever fields that type has, in the order they came in, since a turn is replayed byte for
  byte
*/
export type ConversationContentBlock = {
  type: string
  [field: string]: unknown
}

// The block a member's message and a reply's text are written in
export type ConversationTextBlock = {
  type: 'text'
  text: string
}
