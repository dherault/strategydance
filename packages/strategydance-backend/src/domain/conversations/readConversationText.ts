import type { ConversationContentBlock } from '~types'

import mergeConversationText, {
  type ConversationTextBlockWithCitations,
} from '~domain/conversations/mergeConversationText'
import splitConversationText from '~domain/conversations/splitConversationText'

/*
  The text run starting at `fromBlock`, merged, with where each of its blocks ends, its pieces and
  its citations, and the block after it. A fallback model carries on the text a declining model
  left, so the run goes on across a `fallback` block between two texts, as one reply. The thread
  draws it as one message, or in pieces past 20000 characters, and a subagent's report is its last
*/
function readConversationText(blocks: ConversationContentBlock[], fromBlock: number) {
  let toBlock = fromBlock

  while (isConversationTextBlock(blocks[toBlock]) || blocks[toBlock]?.type === 'fallback') toBlock++
  while (toBlock > fromBlock && !isConversationTextBlock(blocks[toBlock - 1])) toBlock--

  const { text, blockEnds, citations } = mergeConversationText(
    blocks.slice(fromBlock, toBlock).filter(isConversationTextBlock) as ConversationTextBlockWithCitations[],
  )

  return { text, blockEnds, pieces: splitConversationText(text, blockEnds), citations, toBlock }
}

export function isConversationTextBlock(block: ConversationContentBlock | undefined) {
  return block?.type === 'text' && typeof block.text === 'string'
}

export default readConversationText
