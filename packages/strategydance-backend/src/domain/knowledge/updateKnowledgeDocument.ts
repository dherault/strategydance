import { foldDocumentForAgent, getDocumentForAgent, renameDocumentForAgent } from 'strategydance-database/backend'

import type { KnowledgeDocumentEdit, KnowledgeWriteResult, ModuleCall, ModuleCaller } from '~types'

import { KNOWLEDGE_FOLD_ATTEMPTS } from '~constants'

import { dataConnect } from '~firebase'

import explainKnowledgeDocumentRefusal from '~domain/knowledge/explainKnowledgeDocumentRefusal'
import foldKnowledgeDocumentEdit from '~domain/knowledge/foldKnowledgeDocumentEdit'
import hashKnowledgeDocumentText from '~domain/knowledge/hashKnowledgeDocumentText'
import isKnowledgeRefusal from '~domain/knowledge/isKnowledgeRefusal'
import { EDITED_REFUSAL, FOLDED_REFUSAL, NOT_MEMBER_REFUSAL } from '~domain/knowledge/knowledgeRefusalMessages'
import readKnowledgeDocumentText from '~domain/knowledge/readKnowledgeDocumentText'
import toKnowledgeFoldRefusal from '~domain/knowledge/toKnowledgeFoldRefusal'
import answerFromModuleCall from '~domain/modules/answerFromModuleCall'
import isModuleCallKeyTaken from '~domain/modules/isModuleCallKeyTaken'
import toModuleCallVariables from '~domain/modules/toModuleCallVariables'

type UpdateKnowledgeDocumentInput = {
  id: string
  // The version a read gave, which a whole text replaced has to name
  version?: string
  title?: string
  edit?: KnowledgeDocumentEdit
}

// What an update answers: the document's title now, and the version of its text once a text edit
// is stored, which a whole text replaced next can name
export type UpdatedKnowledgeDocument = {
  id: string
  title?: string
  version?: string
}

/*
  An agent's change to a document: its title, an edit of its text, or both, applied to the shared
  text as a member's edits are, so it merges with what they type meanwhile. A title alone is a
  rename. An edit is folded into the snapshot with every pending update merged, and stored under the
  revision it read: when somebody folded more into it meanwhile, the document is read again and the
  edit applied again, three times at most, the call's key checked before each, so a call that landed
  meanwhile under it answers this one. A permission turned off meanwhile is found then too.

  A whole text replaced rewrites everything the agent read, so it has to name the version its read
  gave, and is refused, before anything is written, when the text is no longer that version, a push
  landing between the read and the fold included. Every other edit finds its place afresh, so it
  goes through while somebody types elsewhere in the document.

  A document keeps a title or some text, as it starts with one: a change that would leave it with
  neither is refused, as the page deletes one somebody empties rather than keep it
*/
async function updateKnowledgeDocument(
  caller: ModuleCaller,
  { id, version, title, edit }: UpdateKnowledgeDocumentInput,
  call: ModuleCall | null,
): Promise<KnowledgeWriteResult<UpdatedKnowledgeDocument>> {
  if (edit?.type === 'content' && version === undefined) return { outcome: 'versionRequired' }

  const answered = await answerFromModuleCall(caller, call)

  if (answered) return answered

  const reference = {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
    id,
  }

  if (!edit) {
    // A document keeps a title or some text, as one starts with: a blank title is refused on one
    // whose text is empty, nothing pending that could fill it
    if (title !== undefined && !/\S/.test(title)) {
      const { data } = await getDocumentForAgent(dataConnect, reference)
      const [row] = data.documents

      if (!row) return (await explainKnowledgeDocumentRefusal(caller, id, { isWrite: true })) ?? { outcome: 'notFound' }
      if (row.content === '' && row.documentUpdates_on_document.length === 0) return { outcome: 'empty' }
    }

    const result = { id, title }

    try {
      await renameDocumentForAgent(dataConnect, {
        ...reference,
        title: title ?? '',
        ...toModuleCallVariables(caller, call, result),
      })

      return { outcome: 'written', result }
    } catch (error) {
      const answeredMeanwhile = isModuleCallKeyTaken(error) ? await answerFromModuleCall(caller, call) : null

      if (answeredMeanwhile) return answeredMeanwhile
      if (isKnowledgeRefusal(error, NOT_MEMBER_REFUSAL)) return { outcome: 'notMember' }

      const refusal = await explainKnowledgeDocumentRefusal(caller, id, { isWrite: true })

      if (refusal) return refusal

      throw error
    }
  }

  for (let attempt = 0; attempt < KNOWLEDGE_FOLD_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const answeredMeanwhile = await answerFromModuleCall(caller, call)

      if (answeredMeanwhile) return answeredMeanwhile
    }

    const { data } = await getDocumentForAgent(dataConnect, reference)
    const [row] = data.documents

    if (!row) return (await explainKnowledgeDocumentRefusal(caller, id, { isWrite: true })) ?? { outcome: 'notFound' }
    if (!row.isAiWritable) return { outcome: 'closedToAi' }

    const updates = row.documentUpdates_on_document

    if (edit.type === 'content') {
      // A document read has a snapshot, which its read seeded: one without was never read
      const current = row.state ? readKnowledgeDocumentText({ state: row.state, updates }) : null

      if (current?.outcome !== 'read' || hashKnowledgeDocumentText(current.blocks) !== version) {
        return { outcome: 'changed' }
      }
    }

    const folded = foldKnowledgeDocumentEdit({ state: row.state ?? null, updates, content: row.content }, edit)

    if (folded.outcome !== 'folded') return toKnowledgeFoldRefusal(folded)

    // An edit that empties the text of a document without a title would leave nothing in it
    if (folded.content === '' && !/\S/.test(title ?? row.title)) return { outcome: 'empty' }

    const read = readKnowledgeDocumentText({ state: folded.state, updates: [] })

    if (read.outcome !== 'read') return { outcome: 'invalidEdit' }

    const result = { id, title: title ?? row.title, version: hashKnowledgeDocumentText(read.blocks) }

    try {
      await foldDocumentForAgent(dataConnect, {
        ...reference,
        revision: row.revision,
        state: folded.state,
        content: folded.content,
        contentText: folded.contentText,
        updateIds: folded.updateIds,
        // Left out when the call keeps the title, which leaves it alone and pushes no card
        ...(title !== undefined && { title }),
        isWholeReplacement: edit.type === 'content',
        ...toModuleCallVariables(caller, call, result),
      })

      return { outcome: 'written', result }
    } catch (error) {
      const answeredMeanwhile = isModuleCallKeyTaken(error) ? await answerFromModuleCall(caller, call) : null

      if (answeredMeanwhile) return answeredMeanwhile
      if (isKnowledgeRefusal(error, NOT_MEMBER_REFUSAL)) return { outcome: 'notMember' }
      // A push landed under a whole text replaced: the next read finds the text moved on
      if (isKnowledgeRefusal(error, EDITED_REFUSAL)) continue
      if (!isKnowledgeRefusal(error, FOLDED_REFUSAL)) throw error

      const refusal = await explainKnowledgeDocumentRefusal(caller, id, { isWrite: true })

      if (refusal) return refusal
    }
  }

  return { outcome: 'changed' }
}

export default updateKnowledgeDocument
