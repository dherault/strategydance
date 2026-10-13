import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages'

/*
  The text Claude's fetches brought back, which a review's quotes are checked against: every string
  in the results of the calls its API ran, web fetch's pages and, when web fetch filtered a page
  through code before reading it, what that code printed. Read whatever the result's shape, so a
  shape the API adds later is read too
*/
function collectFetchedText(content: BetaContentBlock[]) {
  const texts: string[] = []

  for (const block of content) {
    if (block.type.endsWith('_tool_result')) collectStrings(block, texts)
  }

  return texts.join('\n')
}

function collectStrings(value: unknown, texts: string[]) {
  if (typeof value === 'string') texts.push(value)
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, texts)
  else if (value && typeof value === 'object') for (const item of Object.values(value)) collectStrings(item, texts)
}

export default collectFetchedText
