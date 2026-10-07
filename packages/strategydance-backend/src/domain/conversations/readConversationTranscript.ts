import { type ConversationTranscriptRole, getConversationTranscript } from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

// How many entries a page holds, the query's `limit`
const PAGE_SIZE = 100

// A transcript entry as a request is built from it
export type ConversationTranscriptRecord = {
  id: string
  position: number
  role: ConversationTranscriptRole
  // The JSON text it was sent as
  content: string
  contextHash: string | null
  runId: string
}

/*
  A conversation's whole transcript, in order, read a page at a time, which a worker reads before
  each request to Claude, since a request carries all of it
*/
async function readConversationTranscript({
  organizationId,
  userId,
  conversationId,
}: Pick<ConversationRunReference, 'organizationId' | 'userId' | 'conversationId'>) {
  const entries: ConversationTranscriptRecord[] = []

  for (;;) {
    const { data } = await getConversationTranscript(dataConnect, {
      organizationId,
      userId,
      conversationId,
      afterPosition: entries.at(-1)?.position ?? -1,
    })

    for (const entry of data.conversationTranscriptEntries) {
      entries.push({
        id: entry.id,
        position: entry.position,
        role: entry.role,
        content: entry.content,
        contextHash: entry.contextHash ?? null,
        runId: entry.run.id,
      })
    }

    if (data.conversationTranscriptEntries.length < PAGE_SIZE) return entries
  }
}

export default readConversationTranscript
