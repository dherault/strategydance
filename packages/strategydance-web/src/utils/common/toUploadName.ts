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
  The name a file goes up under, a conversation's file's or a bill's receipt's, as the backend takes
  one: on one line, without control characters, trimmed, and at most `maxLength` code points, a long
  one cut between graphemes before its extension, which stays. A file with no name, as a pasted one
  can be, takes the fallback
*/
function toUploadName(name: string, fallback: string, maxLength: number) {
  const line = name
    .replace(/[\p{Cc}\u2028\u2029]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!line) return fallback

  if ([...line].length <= maxLength) return line

  const extension = /\.[^.\s]+$/.exec(line)?.[0] ?? ''
  const kept = [...extension].length <= MAX_KEPT_EXTENSION_LENGTH ? extension : ''
  const stem = line.slice(0, line.length - kept.length)

  return `${takeCodePoints(stem, maxLength - [...kept].length).trimEnd()}${kept}`
}

export default toUploadName
