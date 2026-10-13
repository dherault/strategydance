// Longer than a first word of a title usually is, past which it may break, rather than run past the text's width
const MAX_LEAD_LENGTH = 24

/*
  A mention's words as its lead, the first word, which its icon stays on the line with, and the
  rest, which wraps as text does. A first word too long to keep whole, as an address may be, is
  no lead, so it wraps too, and only the icon stays apart
*/
function splitRichTextMentionWords(words: string): [lead: string, rest: string] {
  const [, lead = '', rest = ''] = /^(\S*)([\s\S]*)$/.exec(words) ?? []

  return lead.length > MAX_LEAD_LENGTH ? ['', words] : [lead, rest]
}

export { splitRichTextMentionWords }
