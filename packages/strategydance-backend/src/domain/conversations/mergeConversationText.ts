import type { ConversationCitation } from 'strategydance-core'

// A text block as Claude's API writes one, with the citations web search attached to it
export type ConversationTextBlockWithCitations = {
  type: 'text'
  text: string
  citations?: unknown
}

/*
  The consecutive text blocks of a turn as the one text the thread draws, with where each block
  ends in it, and the spans web search cited: each cited block's whole text, with its sources'
  addresses, titles and quoted words. U+0000 goes before anything is counted, since a Postgres
  `text` refuses it and the offsets are into what is stored
*/
function mergeConversationText(blocks: ConversationTextBlockWithCitations[]) {
  let text = ''
  const blockEnds: number[] = []
  const citations: ConversationCitation[] = []

  for (const block of blocks) {
    const start = text.length
    const blockText = block.text.replaceAll('\u0000', '')

    text += blockText
    blockEnds.push(text.length)

    const sources = Array.isArray(block.citations) ? block.citations.flatMap(readSource) : []

    if (sources.length && blockText) citations.push({ start, end: text.length, sources })
  }

  return { text, blockEnds, citations }
}

// A web search citation's source, or nothing for a citation of another kind
function readSource(citation: unknown): ConversationCitation['sources'] {
  if (typeof citation !== 'object' || citation === null) return []

  const { type, url, title, cited_text: citedText } = citation as Record<string, unknown>

  if (type !== 'web_search_result_location' || typeof url !== 'string') return []

  return [
    {
      url,
      title: typeof title === 'string' ? title.replaceAll('\u0000', '') : null,
      citedText: typeof citedText === 'string' ? citedText.replaceAll('\u0000', '') : '',
    },
  ]
}

export default mergeConversationText
