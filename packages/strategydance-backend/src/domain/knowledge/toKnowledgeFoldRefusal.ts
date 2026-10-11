import type { KnowledgeRefusal } from '~types'

import type foldKnowledgeDocumentEdit from '~domain/knowledge/foldKnowledgeDocumentEdit'

type FoldRefusal = Exclude<ReturnType<typeof foldKnowledgeDocumentEdit>, { outcome: 'folded' }>

/*
  Why an edit could not be applied to a document's text, as the model is told: a block it named
  gone, which a read shows, a piece of text not found exactly once, or a document too long once
  edited. A text holding what this editor cannot read, two blocks under one id included, is the
  team's to sort out
*/
function toKnowledgeFoldRefusal(refusal: FoldRefusal): KnowledgeRefusal {
  switch (refusal.outcome) {
    case 'blockNotFound':
      return { outcome: 'changed' }
    case 'textNotUnique':
      return { outcome: 'textNotUnique', count: refusal.count }
    case 'contentTooLong':
    case 'stateTooLong':
    case 'textNotFound':
    case 'invalidRange':
    case 'invalidEdit':
      return { outcome: refusal.outcome }
    case 'unreadableState':
    case 'unknownContent':
    case 'notSeeded':
    case 'blockNotUnique':
      return { outcome: 'unreadable' }
  }
}

export default toKnowledgeFoldRefusal
