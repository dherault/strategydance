/*
  The id a link of Strategy Dance's reply, or a member's mention, names, `doc:<id>` for a document
  or `task:<id>` for a task, as Data Connect writes one: 32 lowercase hex digits, whether the link
  wrote its hyphens or not, and whatever the case of its scheme. Null for anything else, which names nothing of that kind
*/
function readConversationLinkId(href: string, scheme: 'doc' | 'task') {
  const match = new RegExp(`^${scheme}:([0-9a-f-]{32,36})$`, 'i').exec(href.trim())
  const id = match?.[1]?.replaceAll('-', '').toLowerCase()

  return id && /^[0-9a-f]{32}$/.test(id) ? id : null
}

export default readConversationLinkId
