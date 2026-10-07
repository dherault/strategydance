import type { ConversationCitation } from 'strategydance-core'

import type { ConversationTextPiece } from '~domain/conversations/splitConversationText'

/*
  The citations a piece of a reply keeps: those whose span starts in it, their offsets rebased to
  the piece, and a span that runs on past the piece clipped at its end
*/
function selectPieceCitations(citations: ConversationCitation[], piece: ConversationTextPiece) {
  return citations
    .filter(({ start }) => start >= piece.start && start < piece.end)
    .map(citation => ({
      ...citation,
      start: citation.start - piece.start,
      end: Math.min(citation.end, piece.end) - piece.start,
    }))
}

export default selectPieceCitations
