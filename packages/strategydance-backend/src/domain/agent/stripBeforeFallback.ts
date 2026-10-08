import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages'

/*
  A turn as it is stored and sent again once a model declined partway and a fallback model carried
  on, which the API marks with a `fallback` block at each switch. Before the last of those blocks it
  keeps only text and the calls Claude ran on its own side with their results, each call with its
  result or neither: thinking, redacted thinking, client calls, a server call left without its
  result and whatever else the declining model wrote are dropped, as Anthropic's refusal guide asks
  of a turn echoed back. Every `fallback` block stays where it came, and so does everything after
  the last. A turn without one is kept as it is
*/
function stripBeforeFallback(content: BetaContentBlock[]) {
  const boundary = content.findLastIndex(block => block.type === 'fallback')

  if (boundary === -1) return content

  const resultIds = new Set(content.flatMap(block => ('tool_use_id' in block ? [block.tool_use_id] : [])))
  const pairedCallIds = new Set(
    content.flatMap(block => (isServerCall(block) && resultIds.has(block.id) ? [block.id] : [])),
  )

  return content.filter((block, index) => {
    if (index >= boundary) return true
    if (block.type === 'text' || block.type === 'fallback') return true
    if (isServerCall(block)) return pairedCallIds.has(block.id)

    return 'tool_use_id' in block && pairedCallIds.has(block.tool_use_id)
  })
}

// A call Claude's API ran itself, whose result comes back in the same turn
function isServerCall(block: BetaContentBlock) {
  return block.type === 'server_tool_use' || block.type === 'mcp_tool_use'
}

export default stripBeforeFallback
