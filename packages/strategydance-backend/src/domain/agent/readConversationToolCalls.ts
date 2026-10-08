import type { ConversationContentBlock } from '~types'

// A call Claude made to one of Strategy Dance's own tools: its id, the tool, its input, and which
// block of its turn it is
export type ConversationToolCall = {
  id: string
  name: string
  input: unknown
  block: number
}

/*
  A turn's calls to Strategy Dance's own tools, its `tool_use` blocks, in their order. Calls Claude
  made on its own side, `server_tool_use`, carry their results within the turn and are none of
  them
*/
function readConversationToolCalls(blocks: ConversationContentBlock[]): ConversationToolCall[] {
  return blocks.flatMap((block, index) =>
    block.type === 'tool_use' && typeof block.id === 'string' && typeof block.name === 'string'
      ? [{ id: block.id, name: block.name, input: block.input, block: index }]
      : [],
  )
}

export default readConversationToolCalls
