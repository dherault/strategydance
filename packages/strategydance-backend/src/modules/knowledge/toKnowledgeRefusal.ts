import type { KnowledgeRefusal } from '~types'

import toToolRefusal from '~modules/toToolRefusal'

// A refusal of the Knowledge module, as the model reads it: what happened, in a sentence it can act
// on, by changing what it sent, telling the member, or ending its turn
function toKnowledgeRefusal(refusal: KnowledgeRefusal) {
  return toToolRefusal(toSentence(refusal))
}

function toSentence(refusal: KnowledgeRefusal) {
  switch (refusal.outcome) {
    case 'notMember':
      return 'The member is no longer in this organization, so its knowledge is closed to you.'
    case 'invalidCursor':
      return 'That cursor is not one this tool gave for this kind, query and filters. Start again without it.'
    case 'otherKindFilter':
      return `\`${refusal.filter}\` keeps directories alone. List the DIRECTORY kind to filter by it, or leave it out.`
  }
}

export default toKnowledgeRefusal
