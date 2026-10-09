import type { CallToolResult } from '@modelcontextprotocol/server'

// What a module's tool answers: its result as `structuredContent`, and the same JSON as text, as the
// specification asks for clients that read only text
function toToolResult(structured: Record<string, unknown>): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(structured) }], structuredContent: structured }
}

export default toToolResult
