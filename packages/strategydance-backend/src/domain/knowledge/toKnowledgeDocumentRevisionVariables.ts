import type { KnowledgeDocumentBlock } from '~types'

import compressKnowledgeDocumentRevisionState from '~domain/knowledge/compressKnowledgeDocumentRevisionState'
import hashKnowledgeDocumentText from '~domain/knowledge/hashKnowledgeDocumentText'

type Previous = {
  // The text the edit replaced: its snapshot in base64, its blocks as an agent reads them, and its content
  state: string
  blocks: readonly KnowledgeDocumentBlock[]
  content: string
}

type Revision = {
  // The version of the text the edit left
  afterVersion: string
  // Where the agent acted from, its module call's scope, and the call's idempotency key
  scope: string
  callKey: string | null
}

/*
  What `FoldDocumentWithRevisionForAgent` keeps of the text an agent's edit replaced, as a revision a
  member can go back to: its snapshot, compressed, its content, for a member to look at, and the
  version the edit left, by which an Undo knows nobody has written since. Nothing when the edit left
  the text as it was, so a revision always holds something to go back to: the step is skipped, and
  its variables, required all the same, sent empty
*/
function toKnowledgeDocumentRevisionVariables(previous: Previous, { afterVersion, scope, callKey }: Revision) {
  if (hashKnowledgeDocumentText(previous.blocks) === afterVersion) {
    return {
      isRevised: false,
      revisionScope: '',
      revisionCallKey: null,
      revisionCompressedState: '',
      revisionContent: '',
      revisionAfterVersion: '',
    }
  }

  return {
    isRevised: true,
    revisionScope: scope,
    revisionCallKey: callKey,
    revisionCompressedState: compressKnowledgeDocumentRevisionState(previous.state),
    revisionContent: previous.content,
    revisionAfterVersion: afterVersion,
  }
}

export default toKnowledgeDocumentRevisionVariables
