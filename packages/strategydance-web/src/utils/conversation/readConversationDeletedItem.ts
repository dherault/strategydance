// A document or a task the agent deleted, as its call answered: its id, and until when it can be restored
export type ConversationDeletedItem = {
  id: string
  restorableUntil: number
}

/*
  What a `delete_document` or `delete_task` call that succeeded answered, from its output: the id
  of what it deleted, as Data Connect writes one, and the instant its restore stops being offered.
  Null for an output that says anything else
*/
function readConversationDeletedItem(toolOutput: string | null | undefined): ConversationDeletedItem | null {
  try {
    const { id, restorableUntil } = JSON.parse(toolOutput ?? 'null') as { id?: unknown; restorableUntil?: unknown }
    const until = typeof restorableUntil === 'string' ? Date.parse(restorableUntil) : Number.NaN

    if (typeof id !== 'string' || Number.isNaN(until)) return null

    return { id: id.replaceAll('-', '').toLowerCase(), restorableUntil: until }
  } catch {
    return null
  }
}

export default readConversationDeletedItem
