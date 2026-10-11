/*
  The id of the document a link of Strategy Dance's reply names, `doc:<id>`, as Data Connect writes
  one: 32 lowercase hex digits, whether the agent wrote its hyphens or not. Null for anything else,
  which names no document
*/
function readConversationDocumentId(href: string) {
  const match = /^doc:([0-9a-f-]{32,36})$/i.exec(href.trim())
  const id = match?.[1]?.replaceAll('-', '').toLowerCase()

  return id && /^[0-9a-f]{32}$/.test(id) ? id : null
}

export default readConversationDocumentId
