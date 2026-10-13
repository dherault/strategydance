import type { RichTextMentionSource, RichTextMentionTarget } from 'strategydance-design-system/lib/richText'

/**
 * What a mention draws: what it names, found in its list, with the address it opens and its live
 * title, or its words when the live one is empty; gone, when the list is read and lacks it, since
 * the lists leave deleted documents and tasks out; or its words alone, while there is no list, or
 * no id
 */
export type RichTextMentionState =
  | { kind: 'found'; target: RichTextMentionTarget; href: string; title: string }
  | { kind: 'gone' }
  | { kind: 'words' }

/*
  What a mention of `target`, made with `words`, draws from a page's source, the editor's and
  `RichText`'s alike, so the two draw a mention the same way
*/
function readRichTextMentionState(
  target: RichTextMentionTarget | null,
  words: string,
  source: RichTextMentionSource | null | undefined,
): RichTextMentionState {
  const list = target && source ? (target.kind === 'document' ? source.documents : source.tasks) : null

  if (!target || !source || !list) return { kind: 'words' }

  const live = list.get(target.id)

  if (live === undefined) return { kind: 'gone' }

  return { kind: 'found', target, href: source.getHref(target), title: live.trim() || words }
}

export { readRichTextMentionState }
