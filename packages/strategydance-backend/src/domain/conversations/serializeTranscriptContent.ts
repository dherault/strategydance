import type { ConversationContentBlock } from '~types'

/*
  A transcript entry's content as it is stored: the JSON text of exactly the blocks sent or
  answered, in a `String` column rather than `Any`. Data Connect stores `Any` as `jsonb`, which
  reorders an object's keys, keeps one of two duplicate keys and refuses U+0000, which
  `JSON.stringify` escapes, and Claude refuses a history its thinking blocks were not made with
*/
function serializeTranscriptContent(content: ConversationContentBlock[]) {
  return JSON.stringify(content)
}

export default serializeTranscriptContent
