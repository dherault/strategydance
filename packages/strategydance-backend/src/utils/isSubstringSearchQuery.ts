/*
  Whether a search has to match by substring: whether it holds Chinese or Japanese, which put no
  space between words. The full-text indexes split words on spaces and punctuation, as the `simple`
  configuration does, so they hold a whole Chinese or Japanese sentence as one word and cannot find
  a word inside it. Korean puts spaces between its words, so the indexes serve it
*/
const SUBSTRING_SEARCH_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u

function isSubstringSearchQuery(query: string) {
  return SUBSTRING_SEARCH_PATTERN.test(query)
}

export default isSubstringSearchQuery
