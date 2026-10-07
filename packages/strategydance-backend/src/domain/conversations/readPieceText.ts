import type { ConversationTextPiece } from '~domain/conversations/splitConversationText'

// The text a piece of a reply is drawn with: its slice of the reply, with what reopens and closes a
// block a cut runs through
function readPieceText(text: string, piece: ConversationTextPiece) {
  return (piece.before ?? '') + text.slice(piece.start, piece.end) + (piece.after ?? '')
}

export default readPieceText
