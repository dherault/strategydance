import { createRichTextYUpdate } from 'strategydance-design-system/lib/createRichTextYUpdate'

/*
  The first snapshot of a document stored before its text was shared, built from its content as the
  page builds it, in base64. It is stored, under `SeedDocumentState`'s condition, before any of its
  block ids is handed out, since another seed would give every block another id: a seed that loses
  to somebody else's reads theirs instead
*/
function seedKnowledgeDocumentText(content: string) {
  return Buffer.from(createRichTextYUpdate(content)).toString('base64')
}

export default seedKnowledgeDocumentText
