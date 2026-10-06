import type { ConversationThreadEntry } from '~types'

/*
  A thread's entries with every one at a position from `from` up to `to`, excluded, replaced by a
  batch read for that range, which is all that range holds now: an entry the batch leaves out was
  deleted. Both are oldest first.

  An entry whose fields did not change keeps its object, and the entries keep their array when
  nothing changed at all, so a push that changes one entry draws that entry alone
*/
function replaceConversationThreadRange(
  entries: ConversationThreadEntry[],
  from: number,
  to: number,
  batch: ConversationThreadEntry[],
) {
  const held = new Map(entries.map(entry => [entry.id, entry]))
  const kept = batch.map(entry => {
    const previous = held.get(entry.id)

    return previous && JSON.stringify(previous) === JSON.stringify(entry) ? previous : entry
  })
  const next = [
    ...entries.filter(({ position }) => position < from),
    ...kept,
    ...entries.filter(({ position }) => position >= to),
  ]

  return next.length === entries.length && next.every((entry, index) => entry === entries[index]) ? entries : next
}

export default replaceConversationThreadRange
