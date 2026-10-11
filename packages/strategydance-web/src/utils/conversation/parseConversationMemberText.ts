import readConversationLinkId from '~utils/conversation/readConversationLinkId'

export type ConversationMemberTextSegment =
  | { kind: 'text'; text: string }
  // A knowledge mention, its words as the composer wrote them, escapes undone
  | { kind: 'document'; href: string; label: string }

// `[words](doc:<id>)`, unless its bracket is escaped, its words holding escaped brackets
const MENTION_PATTERN = /(?<!\\)\[((?:\\.|[^\\[\]])+)\]\((doc:[0-9a-f-]{32,36})\)/gi

// A backslash before ASCII punctuation, as Markdown escapes it
const ESCAPE_PATTERN = /\\([!-/:-@[-`{-~])/g

/*
  What a member wrote, cut into its plain text and the knowledge it mentions, which the composer
  sends as `[Title](doc:<id>)`. Only those are read: everything else, a web link and Markdown
  included, stays as the member typed it. A link naming no document's id stays text too
*/
function parseConversationMemberText(text: string) {
  const segments: ConversationMemberTextSegment[] = []
  let index = 0

  for (const match of text.matchAll(MENTION_PATTERN)) {
    const [whole, words, href] = match

    if (!words || !href || !readConversationLinkId(href, 'doc')) continue
    if (match.index > index) segments.push({ kind: 'text', text: text.slice(index, match.index) })

    segments.push({ kind: 'document', href, label: words.replace(ESCAPE_PATTERN, '$1') })
    index = match.index + whole.length
  }

  if (index < text.length) segments.push({ kind: 'text', text: text.slice(index) })

  return segments
}

export default parseConversationMemberText
