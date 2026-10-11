import escapeConversationLinkLabel from '~utils/conversation/escapeConversationLinkLabel'
import findConversationMentions from '~utils/conversation/findConversationMentions'

/*
  A message as it is sent: each `@Title` the composer tracks as `[Title](doc:<id>)`, the link
  Strategy Dance reads the document by, and the rest as written
*/
function serializeConversationMentions(text: string, mentions: ReadonlyMap<string, string>) {
  let serialized = ''
  let index = 0

  for (const { start, end, title, id } of findConversationMentions(text, mentions)) {
    serialized += `${text.slice(index, start)}[${escapeConversationLinkLabel(title)}](doc:${id})`
    index = end
  }

  return serialized + text.slice(index)
}

export default serializeConversationMentions
