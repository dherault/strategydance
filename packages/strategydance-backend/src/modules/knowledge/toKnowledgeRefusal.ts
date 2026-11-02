import type { KnowledgeLinkTarget, KnowledgeRefusal } from '~types'

import { MAX_KNOWLEDGE_LINKS } from '~constants'

import toToolRefusal from '~modules/toToolRefusal'

// A refusal of the Knowledge module, as the model reads it: what happened, in a sentence it can act
// on, by changing what it sent, telling the member, or ending its turn
function toKnowledgeRefusal(refusal: KnowledgeRefusal) {
  return toToolRefusal(toSentence(refusal))
}

// Each kind of target as a sentence counts them
const TARGET_PLURALS: Record<KnowledgeLinkTarget, string> = {
  document: 'documents',
  task: 'tasks',
  member: 'members',
}

function toSentence(refusal: KnowledgeRefusal) {
  switch (refusal.outcome) {
    case 'notMember':
      return 'The member is no longer in this organization, so its knowledge is closed to you.'
    case 'readOnly':
      return 'This connection may only read the knowledge.'
    case 'keyConflict':
      return 'That idempotency key was sent before with another call. Send a new key with each new call.'
    case 'unknownItem':
      return `Strategy Dance's knowledge holds no ${refusal.kind} with the id "${refusal.id}". List the kind to find the item's id.`
    case 'noTarget':
      return 'Name exactly one of `documentId`, `taskId` and `member`: a call links or unlinks one target.'
    case 'documentNotFound':
      return 'The organization holds no document by that id: it may have been deleted. Search or list the documents to find it.'
    case 'documentKeptFromAi':
      return "The team keeps this document from AI, so you can neither link nor unlink it. Tell the member, who can let AI read it on the document's page."
    case 'taskNotFound':
      return 'The board holds no task by that id: it may have been deleted. List the tasks to find it.'
    case 'memberNotFound':
      return 'That person is not a member of the organization. Name a member as member:<id>, as the tasks name them, or "me" for the member you act as.'
    case 'tooManyLinks':
      return `An item links at most ${MAX_KNOWLEDGE_LINKS} ${TARGET_PLURALS[refusal.target]}. Unlink one it no longer involves first.`
    case 'invalidCursor':
      return 'That cursor is not one this tool gave for this kind, query and filters. Start again without it.'
    case 'otherKindFilter':
      return `\`${refusal.filter}\` keeps directories alone. List the DIRECTORY kind to filter by it, or leave it out.`
  }
}

export default toKnowledgeRefusal
