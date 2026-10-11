import readConversationLinkId from '~utils/conversation/readConversationLinkId'

export type ConversationLinkTarget<Item> = { kind: 'words' } | { kind: 'gone' } | { kind: 'found'; item: Item }

/*
  What a link of Strategy Dance's reply to a document or a task draws, from the organization's live
  list of them by id: the item it names, found; gone, for an id the list lacks, since the lists
  leave deleted items out, whether it was deleted, pruned or never there; or the agent's words alone,
  for a link naming no id of its kind, and for every link while the list is not read
*/
function readConversationLinkTarget<Item>(
  href: string,
  scheme: 'doc' | 'task',
  items: ReadonlyMap<string, Item> | null,
): ConversationLinkTarget<Item> {
  const id = readConversationLinkId(href, scheme)

  if (!id || !items) return { kind: 'words' }

  const item = items.get(id)

  return item ? { kind: 'found', item } : { kind: 'gone' }
}

export default readConversationLinkTarget
