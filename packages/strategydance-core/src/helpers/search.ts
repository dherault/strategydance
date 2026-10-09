/*
  A search's words: the query split on whitespace, however much of it, and none empty. Every word
  has to match, so the search field and the backend bound a query by how many it holds
  (`MAX_SEARCH_TERMS`), and the backend searches a language written without spaces by these words
  as they are
*/
export function splitSearchTerms(query: string) {
  return query.split(/\s+/u).filter(Boolean)
}
