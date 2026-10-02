// A UUID as Data Connect writes one back and `createId` makes one: 32 hex digits, no dashes
const KNOWLEDGE_DOCUMENT_ID_PATTERN = /^[0-9a-f]{32}$/

// Whether an address's segment can name a document at all, so one that cannot is a page that does
// not exist rather than a read the server would only refuse
function isKnowledgeDocumentId(value: string) {
  return KNOWLEDGE_DOCUMENT_ID_PATTERN.test(value)
}

export default isKnowledgeDocumentId
