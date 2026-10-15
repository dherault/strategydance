import deriveUuid from '~utils/deriveUuid'

/*
  The id of a message the backend draws, derived from what it is drawn from: a transcript entry's id
  with its blocks and its piece, or a run's id with what its note says. Drawing the same thing twice,
  as a worker taking over after a crash can, then inserts one id twice, which the database refuses,
  rather than a second copy (`deriveUuid`)
*/
function deriveConversationMessageId(...parts: (string | number)[]) {
  return deriveUuid(...parts)
}

export default deriveConversationMessageId
