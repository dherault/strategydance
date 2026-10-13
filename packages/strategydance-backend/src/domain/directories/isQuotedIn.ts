import { MIN_DIRECTORY_EVIDENCE_LENGTH } from '~domain/directories/directoryCheckSettings'

/*
  Whether a quote Claude gave appears in the text it says it read, its case, spaces, quotation
  marks and dashes aside. An ellipsis in the quote stands for what it left out, so each piece around
  one has to appear, in order. A quote too short to prove anything never does
*/
function isQuotedIn(quote: string, text: string) {
  const normalizedText = normalize(text)
  const pieces = normalize(quote)
    .split(/\.{3,}/)
    .map(piece => piece.trim())
    .filter(Boolean)

  if (pieces.join(' ').length < MIN_DIRECTORY_EVIDENCE_LENGTH) return false

  let from = 0

  for (const piece of pieces) {
    const index = normalizedText.indexOf(piece, from)

    if (index === -1) return false

    from = index + piece.length
  }

  return true
}

function normalize(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
}

export default isQuotedIn
