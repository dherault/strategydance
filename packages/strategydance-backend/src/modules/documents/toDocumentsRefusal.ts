import { MAX_DOCUMENT_CONTENT_LENGTH, MAX_DOCUMENTS } from 'strategydance-core'

import type { DocumentsRefusal } from '~types'

import toToolRefusal from '~modules/toToolRefusal'
import toTooManySearchesSentence from '~modules/toTooManySearchesSentence'

/*
  A refusal of the Documents module, as the model reads it: what happened, in a sentence it can act
  on, by telling the member, reading the document again, or changing what it sent
*/
function toDocumentsRefusal(refusal: DocumentsRefusal) {
  return toToolRefusal(toSentence(refusal))
}

function toSentence(refusal: DocumentsRefusal) {
  switch (refusal.outcome) {
    case 'notMember':
      return 'The member is no longer in this organization, so its documents are closed to you.'
    case 'readOnly':
      return 'This connection may only read documents. Ask the member to connect again with write access to change them.'
    case 'fromReaction':
      return "This run reacts to subagents' reports, and deletes nothing. Ask the member with ask_user whether the document should go: the run their answer starts can delete it."
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
      return `The organization holds ${MAX_DOCUMENTS} documents, the most it keeps. Tell the member, who can delete one first.`
    case 'empty':
      return 'A document keeps a title or some text: give it one.'
    case 'contentTooLong':
      return `That would take the document past ${MAX_DOCUMENT_CONTENT_LENGTH} characters, the most it holds. Shorten it, or put the rest in another document.`
    case 'stateTooLong':
      return "The document's shared history has grown too large to take this edit. Tell the member, who can copy it into a new document."
    case 'textNotFound':
      return 'That text does not occur in the document. Read it again and copy the text exactly. A mention, a doc: or task: link, is no text to find: replace its block to change it.'
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
    case 'tooManySearches':
      return toTooManySearchesSentence(refusal.retryAfterMs, 'call list_documents')
  }
}

export default toDocumentsRefusal
