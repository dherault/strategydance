export type ConversationMention = {
  // Where its `@` is
  start: number
  // Just after its title
  end: number
  title: string
  id: string
}

// A letter, an accent on one, a digit or a joining underscore: a title followed by one is only
// the start of a longer word
const WORD_CHARACTER_PATTERN = /[\p{L}\p{M}\p{N}\p{Pc}]/u

/*
  The documents a message mentions: each `@` that starts the text or follows a space, followed by
  the title of a document the composer tracks, `mentions` holding each title's id. The longest
  title wins, so `@Plan B` is "Plan B" rather than "Plan" followed by " B", and a title must end
  where a word does, so `@Planning` is no mention of "Plan". The scan carries on after each
  mention, so a title holding an `@` is never read again inside it
*/
function findConversationMentions(text: string, mentions: ReadonlyMap<string, string>) {
  const found: ConversationMention[] = []
  const titles = [...mentions.keys()].filter(Boolean).sort((a, b) => b.length - a.length)
  let index = 0

  while (titles.length) {
    const start = text.indexOf('@', index)

    if (start === -1) break

    index = start + 1

    if (start > 0 && !/\s/.test(text.charAt(start - 1))) continue

    const title = titles.find(candidate => {
      if (!text.startsWith(candidate, start + 1)) return false

      const next = text.codePointAt(start + 1 + candidate.length)

      return next === undefined || !WORD_CHARACTER_PATTERN.test(String.fromCodePoint(next))
    })
    const id = title ? mentions.get(title) : undefined

    if (!title || !id) continue

    found.push({ start, end: start + 1 + title.length, title, id })
    index = start + 1 + title.length
  }

  return found
}

export default findConversationMentions
