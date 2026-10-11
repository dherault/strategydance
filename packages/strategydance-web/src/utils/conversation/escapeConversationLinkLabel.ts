/*
  A document's title as the words of a Markdown link, `[words](doc:<id>)`: its brackets and
  backslashes escaped, since a title may hold any character, and nothing else, which the words of
  a link keep as they are
*/
function escapeConversationLinkLabel(title: string) {
  return title.replace(/[\\[\]]/g, '\\$&')
}

export default escapeConversationLinkLabel
