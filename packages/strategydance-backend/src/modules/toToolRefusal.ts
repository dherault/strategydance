import type { CallToolResult } from '@modelcontextprotocol/server'

// A module's tool refusing a call: a result the model reads, with a sentence it can act on, never a
// protocol error, so it can correct itself
function toToolRefusal(sentence: string): CallToolResult {
  return { content: [{ type: 'text', text: sentence }], isError: true }
}

export default toToolRefusal
