import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import type { DirectoryPage } from '~types'

/*
  The pages Claude's web fetch brought back, each with its address and its text, which a review's
  quotes are checked against, page by page. Only a fetch's document counts, whether Claude called
  web fetch directly or from the code dynamic filtering runs: never what that code printed, which
  Claude wrote, nor a result's own fields, its type, its address or an error's code. A page fetched
  as a PDF holds no text here
*/
function collectFetchedPages(content: BetaContentBlock[]): DirectoryPage[] {
  return content.flatMap(block => {
    if (block.type !== 'web_fetch_tool_result' || block.content.type !== 'web_fetch_result') return []

    const { url, content: document } = block.content

    return document.source.type === 'text' ? [{ url, text: document.source.data }] : []
  })
}

export default collectFetchedPages
