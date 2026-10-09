import { storeConversationTurn, storeConversationTurnWithContext } from 'strategydance-database/backend'

import type { ConversationRunFence } from '~types'

import { dataConnect } from '~firebase'

import { placeConversationRequest } from '~domain/conversations/conversationRunUsage'
import type { ConversationRunLease } from '~domain/conversations/createConversationRunLease'
import type { ConversationTurnOutcome } from '~domain/conversations/requestConversationTurn'
import serializeTranscriptContent from '~domain/conversations/serializeTranscriptContent'

type StoreConversationPartsInput = {
  fence: ConversationRunFence
  lease: ConversationRunLease
  turn: Extract<ConversationTurnOutcome, { kind: 'turn' }>
  // The run's entries the transcript holds already, by id, which a write before a refusal stored
  storedEntryIds: Set<string>
}

/*
  Stores a turn's parts in the transcript, one write each, in order: the first with the run's
  context message when it is not stored yet, at consecutive positions, so the transcript never ends
  on it. Each write settles where its request's part went in the ledger it carries. A part stored
  by a write before a refusal is passed over, so storing again after one stores each part once.

  A crash between two parts leaves the turn paused at the last one stored, which the ledger says,
  and the worker taking over sends its continuation
*/
async function storeConversationParts({ fence, lease, turn, storedEntryIds }: StoreConversationPartsInput) {
  const offset = turn.context ? 1 : 0
  let { usage } = turn

  for (const [index, part] of turn.parts.entries()) {
    const position = turn.firstPosition + offset + index

    usage = placeConversationRequest(usage, part.requestIndex, position)

    if (storedEntryIds.has(part.entryId)) continue

    const content = serializeTranscriptContent(part.content)
    const partUsage = usage

    if (index === 0 && turn.context) {
      const { context } = turn

      await lease.write(() =>
        storeConversationTurnWithContext(dataConnect, {
          ...fence,
          contextEntryId: turn.contextEntryId,
          contextPosition: turn.firstPosition,
          contextContent: serializeTranscriptContent(context.content),
          contextHash: context.hash,
          entryId: part.entryId,
          position,
          content,
          usage: partUsage,
        }),
      )
    } else {
      await lease.write(() =>
        storeConversationTurn(dataConnect, { ...fence, entryId: part.entryId, position, content, usage: partUsage }),
      )
    }
  }
}

export default storeConversationParts
