import { CONVERSATION_ATTACHMENT_UPLOADS_AT_ONCE } from '~constants'

import createTaskQueue from '~utils/common/createTaskQueue'

/*
  The files the tab is uploading to conversations, by their ids, a few at a time, the rest waiting
  their turn: kept for the life of the tab rather than by a composer, so an upload goes on while
  its conversation moves between its page and the dock, or its window is minimized, and a file
  removed from any of them stops going up. What each upload has done is written in its composer's
  draft
*/
const uploads = createTaskQueue(CONVERSATION_ATTACHMENT_UPLOADS_AT_ONCE)

export const runConversationAttachmentUpload = uploads.run

export const abortConversationAttachmentUpload = uploads.abort

// Every upload, waiting or under way, as an account leaving the tab stops them
export const abortConversationAttachmentUploads = uploads.abortAll
