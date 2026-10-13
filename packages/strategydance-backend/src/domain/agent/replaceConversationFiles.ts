import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'

// What each file a conversation sent takes in a request, by its id in the Files API, as its upload
// counted it from its bytes
export type ConversationFileTokens = ReadonlyMap<string, number>

/*
  A request's messages as the count endpoint takes them, which refuses a Files API source: every
  image and document block referencing a file taken out, its stored count summed instead, and a
  message left with nothing given a dot, which the endpoint counts as next to nothing. A file no
  count is known for is an error rather than a guess, since every file a conversation sent is
  counted when it is stored
*/
function replaceConversationFiles(messages: BetaMessageParam[], fileTokens: ConversationFileTokens) {
  let tokens = 0

  const replaced = messages.map(message => {
    if (typeof message.content === 'string') return message

    const content = message.content.filter(block => {
      if ((block.type !== 'image' && block.type !== 'document') || block.source.type !== 'file') return true

      const count = fileTokens.get(block.source.file_id)

      if (count === undefined) throw new Error(`File ${block.source.file_id} has no count among its conversation's`)

      tokens += count

      return false
    })

    if (content.length === message.content.length) return message

    return { ...message, content: content.length ? content : [{ type: 'text' as const, text: '.' }] }
  })

  return { messages: replaced, fileTokens: tokens }
}

export default replaceConversationFiles
