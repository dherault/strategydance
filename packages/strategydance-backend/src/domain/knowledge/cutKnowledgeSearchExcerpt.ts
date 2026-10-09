import { KNOWLEDGE_SEARCH_EXCERPT_LENGTH } from '~constants'

// How much of the text before the first matched word an excerpt keeps, so the word reads in context
const LEAD_LENGTH = 60

const ELLIPSIS = '…'

/*
  The part of a document's plain text a search shows: about 240 characters on one line, around the
  first place one of the query's words occurs, ignoring case, or from the start when none does, as a
  title alone may match. Cut short with an ellipsis on the side it was cut, never inside a character
  a surrogate pair writes
*/
function cutKnowledgeSearchExcerpt(text: string, terms: readonly string[]) {
  const folded = text.replace(/\s+/g, ' ').trim()

  if (folded.length <= KNOWLEDGE_SEARCH_EXCERPT_LENGTH) return folded

  const matches = terms
    .map(term => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').exec(folded)?.index)
    .filter((index): index is number => index !== undefined)
  const first = matches.length > 0 ? Math.min(...matches) : 0
  const start = snap(
    folded,
    Math.max(0, Math.min(first - LEAD_LENGTH, folded.length - KNOWLEDGE_SEARCH_EXCERPT_LENGTH)),
  )
  const end = snap(folded, Math.min(folded.length, start + KNOWLEDGE_SEARCH_EXCERPT_LENGTH))

  return `${start > 0 ? ELLIPSIS : ''}${folded.slice(start, end).trim()}${end < folded.length ? ELLIPSIS : ''}`
}

// An index moved back off the second half of a surrogate pair
function snap(text: string, index: number) {
  const code = text.charCodeAt(index)

  return code >= 0xdc00 && code <= 0xdfff && index > 0 ? index - 1 : index
}

export default cutKnowledgeSearchExcerpt
