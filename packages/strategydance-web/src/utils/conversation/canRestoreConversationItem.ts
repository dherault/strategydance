import type { ConversationDeletedItem } from '~utils/conversation/readConversationDeletedItem'

/*
  Whether a row that deleted a document or a task offers to restore it: while the organization's
  live list of them, once read, does not hold it, and a day has not passed since the call. One
  restored since, by anybody, is back in the list, and a restore past the day would be refused
*/
function canRestoreConversationItem(
  deleted: ConversationDeletedItem | null,
  live: ReadonlyMap<string, unknown> | null,
  now: number,
) {
  return Boolean(deleted && live && !live.has(deleted.id) && now < deleted.restorableUntil)
}

export default canRestoreConversationItem
