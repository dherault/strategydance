import { buildConversationPreview } from 'strategydance-core'
import { drawConversationAgentText } from 'strategydance-database/backend'

import type { ConversationContentBlock, ConversationRunFence, ConversationTextBlock } from '~types'

import { dataConnect } from '~firebase'

import type { ConversationRunLease } from '~domain/conversations/createConversationRunLease'
import deriveConversationMessageId from '~domain/conversations/deriveConversationMessageId'

type DrawConversationTurnInput = {
  fence: ConversationRunFence
  lease: ConversationRunLease
  // The transcript entry to draw, its blocks, and how many of them the thread has drawn
  entry: { id: string; drawnBlocks: number }
  blocks: ConversationContentBlock[]
  // The conversation's counter, where the message goes
  position: number
}

/*
  Draws the next message of a stored turn, from the entry's cursor on, and answers whether there
  was one: the consecutive text blocks after the cursor as one reply, with the blocks before them
  that draw nothing, a thinking block say, passed over in the same move. Once no text is left
  after the cursor the turn is drawn, whatever blocks it ends on.

  The message's id derives from the entry, the first block it moves past and its piece, so a worker
  taking over after a crash, which draws from the same cursor, derives the same one
*/
async function drawConversationTurn({ fence, lease, entry, blocks, position }: DrawConversationTurnInput) {
  const fromBlock = entry.drawnBlocks
  let toBlock = fromBlock

  while (toBlock < blocks.length && !isTextBlock(blocks[toBlock])) toBlock++

  if (toBlock === blocks.length) return false

  let text = ''

  for (let block = blocks[toBlock]; isTextBlock(block); block = blocks[++toBlock]) text += block.text

  // A Postgres `text` column refuses U+0000, which the transcript keeps
  const drawnText = text.replaceAll('\u0000', '')
  const messageId = deriveConversationMessageId(entry.id, fromBlock, 0)

  await lease.write(() =>
    drawConversationAgentText(dataConnect, {
      ...fence,
      entryId: entry.id,
      fromBlock,
      toBlock,
      messageId,
      position,
      text: drawnText,
      preview: buildConversationPreview({ kind: 'AGENT_TEXT', text: drawnText }),
    }),
  )

  return true
}

function isTextBlock(block: ConversationContentBlock | undefined): block is ConversationTextBlock {
  return block?.type === 'text' && typeof block.text === 'string'
}

export default drawConversationTurn
