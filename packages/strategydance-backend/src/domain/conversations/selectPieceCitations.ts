import type { ConversationCitation } from 'strategydance-core'

import type { ConversationTextPiece } from '~domain/conversations/splitConversationText'

/*
  The citations a piece of a reply keeps: those whose span starts in it, their offsets rebased to
  the piece as it is drawn, after what reopens a block a cut ran through, and a span that runs on
  past the piece clipped at its end
*/
function selectPieceCitations(citations: ConversationCitation[], piece: ConversationTextPiece) {
  const offset = (piece.before?.length ?? 0) - piece.start

  return citations
    .filter(({ start }) => start >= piece.start && start < piece.end)
    .map(citation => ({
      ...citation,
      start: citation.start + offset,
      end: Math.min(citation.end, piece.end) + offset,
    }))
}

export default selectPieceCitations
