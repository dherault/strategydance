import compressDocumentRevisionState from '~domain/documents/compressDocumentRevisionState'

type Previous = {
  // The text the edit replaced: its snapshot in base64, its content and its fingerprint
  state: string
  content: string
  fingerprint: string
}

type Revision = {
  // A fingerprint of the text the edit left
  afterFingerprint: string
  // Where the agent acted from, its module call's scope, and the call's idempotency key
  scope: string
  callKey: string | null
}

/*
  What `FoldDocumentWithRevisionForAgent` keeps of the text an agent's edit replaced, as a revision a
  member can go back to: its snapshot, compressed, its content, for a member to look at, and a
  fingerprint of the text the edit left, by which an Undo knows nobody has written since. Nothing
  when the edit left the text exactly as it was, so a revision always holds something to go back
  to: the step is skipped, and its variables, required all the same, sent empty
*/
function toDocumentRevisionVariables(previous: Previous, { afterFingerprint, scope, callKey }: Revision) {
  if (previous.fingerprint === afterFingerprint) {
    return {
      isRevised: false,
      revisionScope: '',
      revisionCallKey: null,
      revisionCompressedState: '',
      revisionContent: '',
      revisionAfterFingerprint: '',
    }
  }

  return {
    isRevised: true,
    revisionScope: scope,
    revisionCallKey: callKey,
    revisionCompressedState: compressDocumentRevisionState(previous.state),
    revisionContent: previous.content,
    revisionAfterFingerprint: afterFingerprint,
  }
}

export default toDocumentRevisionVariables
