import { ConversationMessageKind } from 'strategydance-database/web'
import type { MarkdownCitationMarker } from 'strategydance-design-system/components/ui/Markdown'

import type { ConversationMessageBody, ConversationThreadEntry } from '~types'

import parseConversationCitations from '~utils/conversation/parseConversationCitations'

// A source a reply cites, by the number its markers and its list show
export type ConversationReplySource = {
  number: number
  url: string
  title: string | null
}

// How a piece of a reply is drawn
export type ConversationReplyPiece = {
  // The markers after its cited spans, each keyed by its source's number
  markers: MarkdownCitationMarker[]
  // The reply's sources, numbered across all its pieces
  sources: ConversationReplySource[]
  // Whether it carries on the piece before it, drawn without the gap between entries
  isContinuation: boolean
  // Whether it is the reply's last piece, under which its sources are listed
  isLast: boolean
}

/*
  Finds the thread's replies, each the consecutive texts of one run, a reply past 20000 characters
  being drawn in several, and numbers each reply's sources across its pieces, in the order they are
  first cited, an address once. A piece whose body has not landed yet cites nothing until it does
*/
function groupConversationReplies(
  entries: ConversationThreadEntry[],
  bodies: ReadonlyMap<string, ConversationMessageBody>,
) {
  const pieces = new Map<string, ConversationReplyPiece>()
  let reply: { runId: string | null; sources: ConversationReplySource[]; entryIds: string[] } | null = null

  for (const entry of entries) {
    if (entry.kind !== ConversationMessageKind.AGENT_TEXT) {
      reply = null

      continue
    }

    const runId = entry.run?.id ?? null
    const isContinuation = reply !== null && reply.runId === runId

    if (!reply || !isContinuation) reply = { runId, sources: [], entryIds: [] }

    const { sources } = reply
    const markers: MarkdownCitationMarker[] = []

    for (const citation of parseConversationCitations(bodies.get(entry.id)?.citations)) {
      for (const source of citation.sources) {
        let number = sources.find(({ url }) => url === source.url)?.number

        if (number === undefined) {
          number = sources.length + 1
          sources.push({ number, url: source.url, title: source.title })
        }

        if (!markers.some(marker => marker.offset === citation.end && marker.key === String(number))) {
          markers.push({ offset: citation.end, key: String(number) })
        }
      }
    }

    const previous = reply.entryIds.at(-1)
    const previousPiece = previous ? pieces.get(previous) : undefined

    if (previousPiece) previousPiece.isLast = false

    reply.entryIds.push(entry.id)
    pieces.set(entry.id, { markers, sources, isContinuation, isLast: true })
  }

  return pieces
}

export default groupConversationReplies
