import { MAX_DOCUMENT_CONTENT_LENGTH, MAX_DOCUMENTS } from 'strategydance-core'

import type { KnowledgeRefusal } from '~types'

import toToolRefusal from '~modules/toToolRefusal'

/*
  A refusal of the Knowledge module, as the model reads it: what happened, in a sentence it can act
  on, by telling the member, reading the document again, or changing what it sent
*/
function toKnowledgeRefusal(refusal: KnowledgeRefusal) {
  return toToolRefusal(toSentence(refusal))
}

function toSentence(refusal: KnowledgeRefusal) {
  switch (refusal.outcome) {
    case 'notMember':
      return 'The member is no longer in this organization, so its knowledge is closed to you.'
    case 'readOnly':
      return 'This connection may only read knowledge. Ask the member to connect again with write access to change it.'
    case 'notFound':
      return 'No document has that id in this organization. Search or list its documents to find it.'
    case 'keptFromAi':
      return 'The team keeps this document from AI. Tell the member you cannot read it.'
    case 'closedToAi':
      return 'The team keeps AI from changing this document. Tell the member instead.'
    case 'changed':
      return 'The document changed since you read it. Read it again first.'
    case 'versionRequired':
      return 'Replacing the whole content takes the version read_document gave. Read the whole document first, then send its version.'
    case 'full':
      return `The organization's knowledge holds ${MAX_DOCUMENTS} documents, the most it keeps. Tell the member, who can delete one first.`
    case 'empty':
      return 'A document starts with a title or some text.'
    case 'contentTooLong':
      return `That would take the document past ${MAX_DOCUMENT_CONTENT_LENGTH} characters, the most it holds. Shorten it, or put the rest in another document.`
    case 'stateTooLong':
      return "The document's shared history has grown too large to take this edit. Tell the member, who can copy it into a new document."
    case 'textNotFound':
      return 'That text does not occur in the document. Read it again and copy the text exactly.'
    case 'textNotUnique':
      return `That text occurs ${refusal.count} times in the document. Include more of the text around it, so it occurs once.`
    case 'invalidRange':
      return 'fromId comes after toId in the document. Name the first block of the range, then its last.'
    case 'unreadable':
      return 'The document holds something this edit cannot be applied to as it stands. Tell the member, who can edit it on its page.'
    case 'invalidEdit':
      return 'The edit would make a document the editor cannot hold. Write it another way.'
    case 'goneForGood':
      return 'The document was deleted over a day ago and is gone for good.'
    case 'notDeleted':
      return 'The document is not deleted, so there is nothing to restore.'
    case 'keyConflict':
      return 'That idempotency key was sent before with another call. Send a new key with each new call.'
    case 'invalidCursor':
      return 'That cursor is not one this tool gave. Start again without it.'
  }
}

export default toKnowledgeRefusal
