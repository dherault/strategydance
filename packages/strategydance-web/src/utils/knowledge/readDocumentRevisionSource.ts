/*
  Where a revision of a document came from, read off the scope its write was kept under: an edit
  Strategy Dance's agent made in a conversation, a subagent's included, whose id the scope names,
  one an external agent a member connected made, or a member's own restore, which keeps none
*/
export type DocumentRevisionSource =
  | { kind: 'conversation'; conversationId: string }
  | { kind: 'connection' }
  | { kind: 'restore' }

const CONVERSATION_SCOPE = /^conversation:([0-9a-f]{32})$/

function readDocumentRevisionSource(scope: string | null | undefined): DocumentRevisionSource {
  if (!scope) return { kind: 'restore' }

  const conversation = CONVERSATION_SCOPE.exec(scope)

  return conversation ? { kind: 'conversation', conversationId: conversation[1] } : { kind: 'connection' }
}

export default readDocumentRevisionSource
