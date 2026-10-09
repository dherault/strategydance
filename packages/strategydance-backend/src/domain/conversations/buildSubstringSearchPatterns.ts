import { MAX_SEARCH_TERMS } from 'strategydance-core'

// What matches any text, filling the patterns a query leaves over
const ANY_TEXT = '%'

/*
  The LIKE patterns `SearchConversationsBySubstring` takes, one a word: `%word%`, the word's `\`, `%`
  and `_` escaped so it matches only itself, then `%` for each of the eight a query leaves over,
  which matches any text. The operation always takes eight, so no pattern is ever optional
*/
function buildSubstringSearchPatterns(terms: string[]) {
  if (terms.length > MAX_SEARCH_TERMS) throw new Error(`A search holds at most ${MAX_SEARCH_TERMS} words`)

  const patterns = Array.from({ length: MAX_SEARCH_TERMS }, (_, index) => {
    const term = terms[index]

    return term === undefined ? ANY_TEXT : `%${term.replace(/[\\%_]/g, character => `\\${character}`)}%`
  })

  return {
    pattern0: patterns[0]!,
    pattern1: patterns[1]!,
    pattern2: patterns[2]!,
    pattern3: patterns[3]!,
    pattern4: patterns[4]!,
    pattern5: patterns[5]!,
    pattern6: patterns[6]!,
    pattern7: patterns[7]!,
  }
}

export default buildSubstringSearchPatterns
