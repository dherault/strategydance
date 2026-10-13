import { normalizeRichTextMentionId } from 'strategydance-design-system/lib/normalizeRichText'
import type { RichTextMentionTarget } from 'strategydance-design-system/lib/richText'

// `doc:` or `task:` and an id, with or without its hyphens, as the agent links a document or a task
const MENTION_HREF = /^(doc|task):([0-9a-f-]{32,36})$/i

/*
  What a link to a document, `doc:<id>`, or to a task, `task:<id>`, names, as Strategy Dance's agent
  writes one: its id as Data Connect writes one, 32 lowercase hex digits, whatever the case of the
  link's scheme and its digits and whether it wrote the hyphens. Null for any other address, a
  `doc:` one naming no such id included
*/
function readRichTextMentionHref(href: string): RichTextMentionTarget | null {
  const match = MENTION_HREF.exec(href.trim())

  if (!match) return null

  const id = normalizeRichTextMentionId(match[2])

  if (!id) return null

  return { kind: match[1].toLowerCase() === 'doc' ? 'document' : 'task', id }
}

export { readRichTextMentionHref }
