import type { ConversationCitation } from 'strategydance-core'

/*
  A reply's `citations`, as the backend wrote them, read back from a column of any JSON: each span
  with its offsets and its sources. A citation that does not have that shape is left out, and so is
  a source whose address is not a web one, which a link to it could not safely be
*/
function parseConversationCitations(value: unknown): ConversationCitation[] {
  if (!Array.isArray(value)) return []

  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return []

    const { start, end, sources } = item as Record<string, unknown>

    if (!Number.isInteger(start) || !Number.isInteger(end) || !Array.isArray(sources)) return []

    const validSources = sources.flatMap(parseSource)

    return validSources.length ? [{ start: start as number, end: end as number, sources: validSources }] : []
  })
}

function parseSource(value: unknown): ConversationCitation['sources'] {
  if (!value || typeof value !== 'object') return []

  const { url, title, citedText } = value as Record<string, unknown>

  if (typeof url !== 'string' || !isWebAddress(url)) return []

  return [
    {
      url,
      title: typeof title === 'string' && title.trim() ? title : null,
      citedText: typeof citedText === 'string' ? citedText : '',
    },
  ]
}

function isWebAddress(url: string) {
  try {
    const { protocol } = new URL(url)

    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

export default parseConversationCitations
