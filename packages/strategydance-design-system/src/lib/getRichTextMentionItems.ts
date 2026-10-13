import type {
  RichTextMentionKind,
  RichTextMentionSource,
  RichTextMentionTarget,
} from 'strategydance-design-system/lib/richText'

// How many of each kind the menu suggests, as the composer's mentions list suggests six documents
const MAX_ITEMS_PER_KIND = 6

/** A document or a task the mentions menu suggests, with its current title or name */
export type RichTextMentionItem = RichTextMentionTarget & { title: string }

/*
  What the mentions menu suggests for what is typed after its `@`: up to six documents, then up to
  six tasks, whose title or name holds it, whatever its case, in the source's order, which is the
  page's. A document without a title, which nothing can find it by, and the document or the task
  being written are never suggested. A kind whose list is not read suggests nothing
*/
function getRichTextMentionItems(source: RichTextMentionSource, query: string): RichTextMentionItem[] {
  const words = query.trim().toLocaleLowerCase()

  const pick = (kind: RichTextMentionKind, list: ReadonlyMap<string, string> | null) =>
    [...(list ?? [])]
      .filter(([id, title]) => {
        const isSelf = source.self?.kind === kind && source.self.id === id

        return !isSelf && !!title.trim() && title.toLocaleLowerCase().includes(words)
      })
      .slice(0, MAX_ITEMS_PER_KIND)
      .map(([id, title]) => ({ kind, id, title: title.trim() }))

  return [...pick('document', source.documents), ...pick('task', source.tasks)]
}

export { getRichTextMentionItems }
