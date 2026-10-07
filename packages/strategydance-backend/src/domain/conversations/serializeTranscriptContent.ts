/*
  A transcript entry's content as it is stored: the JSON text of exactly the blocks sent or
  answered, in a `String` column rather than `Any`. Data Connect stores `Any` as `jsonb`, which
  reorders an object's keys, keeps one of two duplicate keys and refuses U+0000, which
  `JSON.stringify` escapes, and Claude refuses a history its thinking blocks were not made with.
  The blocks are the API's own, or what the backend wrote, a member's message or a context message
*/
function serializeTranscriptContent<Block extends { type: string }>(content: readonly Block[]) {
  return JSON.stringify(content)
}

export default serializeTranscriptContent
