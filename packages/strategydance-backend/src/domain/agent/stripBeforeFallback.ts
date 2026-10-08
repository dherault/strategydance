import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages'

/*
  A turn as it is stored and sent again once a model declined partway and a fallback model carried
  on, which the API marks with a `fallback` block at each switch. Before the last of those blocks it
  keeps only text and the calls Claude ran on its own side with their results, each call with its
  result or neither: thinking, redacted thinking, client calls, a server call left without its
  result and whatever else the declining model wrote are dropped, as Anthropic's refusal guide asks
  of a turn echoed back. Every `fallback` block stays where it came, and so does everything after
  the last.

  A turn `pause_turn` paused comes in parts, which are one turn to the API: they are stripped as
  one, so a boundary in a later part strips the parts before it, and a call in one part keeps its
  result in the next. A part may be left empty, which its caller drops. A turn without a boundary is
  kept as it is
*/
function stripBeforeFallback(parts: BetaContentBlock[][]) {
  const blocks = parts.flat()
  const boundary = blocks.findLastIndex(block => block.type === 'fallback')

  if (boundary === -1) return parts

  const resultIds = new Set(blocks.flatMap(block => ('tool_use_id' in block ? [block.tool_use_id] : [])))
  const pairedCallIds = new Set(
    blocks.flatMap(block => (isServerCall(block) && resultIds.has(block.id) ? [block.id] : [])),
  )

  function isKept(block: BetaContentBlock, index: number) {
    if (index >= boundary) return true
    if (block.type === 'text' || block.type === 'fallback') return true
    if (isServerCall(block)) return pairedCallIds.has(block.id)

    return 'tool_use_id' in block && pairedCallIds.has(block.tool_use_id)
  }

  let offset = 0

  return parts.map(part => {
    const start = offset

    offset += part.length

    return part.filter((block, index) => isKept(block, start + index))
  })
}

// A call Claude's API ran itself, whose result comes back in the same turn
function isServerCall(block: BetaContentBlock) {
  return block.type === 'server_tool_use' || block.type === 'mcp_tool_use'
}

export default stripBeforeFallback
