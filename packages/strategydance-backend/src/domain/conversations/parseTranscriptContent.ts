import type { ConversationContentBlock } from '~types'

/*
  A transcript entry's content as it was stored by `serializeTranscriptContent`, parsed again only
  to be sent: the blocks with their fields in the order they came in, so writing them out again
  gives back the very bytes stored. Throws on anything else, which no write of the backend stores
*/
function parseTranscriptContent(content: string): ConversationContentBlock[] {
  const blocks: unknown = JSON.parse(content)

  if (!Array.isArray(blocks) || !blocks.every(isContentBlock)) {
    throw new Error('A transcript entry holds a list of content blocks')
  }

  return blocks
}

function isContentBlock(block: unknown): block is ConversationContentBlock {
  return typeof block === 'object' && block !== null && typeof (block as { type?: unknown }).type === 'string'
}

export default parseTranscriptContent
