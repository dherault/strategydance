// A document the agent deleted, as its call answered: its id, and until when it can be restored
export type ConversationDeletedDocument = {
  documentId: string
  restorableUntil: number
}

/*
  What a `delete_document` call that succeeded answered, from its output: the document's id, as
  Data Connect writes one, and the instant its restore stops being offered. Null for an output that
  says anything else
*/
function readConversationDeletedDocument(toolOutput: string | null | undefined): ConversationDeletedDocument | null {
  try {
    const { id, restorableUntil } = JSON.parse(toolOutput ?? 'null') as { id?: unknown; restorableUntil?: unknown }
    const until = typeof restorableUntil === 'string' ? Date.parse(restorableUntil) : Number.NaN

    if (typeof id !== 'string' || Number.isNaN(until)) return null

    return { documentId: id.replaceAll('-', '').toLowerCase(), restorableUntil: until }
  } catch {
    return null
  }
}

export default readConversationDeletedDocument
