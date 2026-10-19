import type { KnowledgeDocumentBlock } from '~types'

import { MAX_DOCUMENT_REVISION_MARKDOWN_LENGTH } from '~constants'

import hashKnowledgeDocumentText from '~domain/knowledge/hashKnowledgeDocumentText'
import toKnowledgeDocumentMarkdown from '~domain/knowledge/toKnowledgeDocumentMarkdown'

type Revision = {
  // The text the edit replaced, its snapshot in base64
  state: string
  // The version of the text the edit left
  afterVersion: string
  // Where the agent acted from, its module call's scope, and the call's idempotency key
  scope: string
  callKey: string | null
}

/*
  What `FoldDocumentWithRevisionForAgent` keeps of the text an agent's edit replaced, as a revision a
  member can go back to: its snapshot, its Markdown, and the version the edit left, by which an Undo
  knows nobody has written since. Nothing when the edit left the text as it was, so a revision
  always holds something to go back to: the step is skipped, and its variables, required all the
  same, sent empty. The Markdown is for a member to look at, so one past its bound is cut rather
  than refuse the edit
*/
function toKnowledgeDocumentRevisionVariables(
  previous: readonly KnowledgeDocumentBlock[],
  { state, afterVersion, scope, callKey }: Revision,
) {
  if (hashKnowledgeDocumentText(previous) === afterVersion) {
    return {
      isRevised: false,
      revisionScope: '',
      revisionCallKey: null,
      revisionState: '',
      revisionMarkdown: '',
      revisionAfterVersion: '',
    }
  }

  return {
    isRevised: true,
    revisionScope: scope,
    revisionCallKey: callKey,
    revisionState: state,
    revisionMarkdown: toKnowledgeDocumentMarkdown(previous).slice(0, MAX_DOCUMENT_REVISION_MARKDOWN_LENGTH),
    revisionAfterVersion: afterVersion,
  }
}

export default toKnowledgeDocumentRevisionVariables
