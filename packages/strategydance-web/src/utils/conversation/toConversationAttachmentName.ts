import { MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH } from 'strategydance-core'

// How long an extension is kept whole when a long name is cut, its dot included
const MAX_KEPT_EXTENSION_LENGTH = 16

// The longest start of a text, cut between graphemes, holding at most a number of code points
function takeCodePoints(text: string, length: number) {
  let cut = ''

  for (const { segment } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) {
    if ([...cut].length + [...segment].length > length) break

    cut += segment
  }

  return cut
}

/*
  The name a file goes to a conversation under, as the backend takes one: on one line, without
  control characters, trimmed, and at most `MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH` code points,
  a long one cut between graphemes before its extension, which stays. A file with no name, as a
  pasted one can be, takes the fallback
*/
function toConversationAttachmentName(name: string, fallback: string) {
  const line = name
    .replace(/[\p{Cc}\u2028\u2029]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!line) return fallback

  if ([...line].length <= MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH) return line

  const extension = /\.[^.\s]+$/.exec(line)?.[0] ?? ''
  const kept = [...extension].length <= MAX_KEPT_EXTENSION_LENGTH ? extension : ''
  const stem = line.slice(0, line.length - kept.length)

  return `${takeCodePoints(stem, MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH - [...kept].length).trimEnd()}${kept}`
}

export default toConversationAttachmentName
