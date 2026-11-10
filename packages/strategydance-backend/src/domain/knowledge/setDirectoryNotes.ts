import {
  createKnowledgeNoteForAgent,
  KnowledgeKind as DatabaseKnowledgeKind,
  updateKnowledgeNoteForAgent,
} from 'strategydance-database/backend'

import type { KnowledgeWriteResult, ModuleCall, ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

import findKnowledgeEntry from '~domain/knowledge/findKnowledgeEntry'
import hashKnowledgeNote from '~domain/knowledge/hashKnowledgeNote'
import markdownToKnowledgeNote from '~domain/knowledge/markdownToKnowledgeNote'
import readKnowledgeState from '~domain/knowledge/readKnowledgeState'
import answerFromModuleCall from '~domain/modules/answerFromModuleCall'
import isModuleCallKeyTaken from '~domain/modules/isModuleCallKeyTaken'
import isOperationRefusal from '~domain/modules/isOperationRefusal'
import { NOT_MEMBER_REFUSAL } from '~domain/modules/moduleRefusalMessages'
import toModuleCallVariables from '~domain/modules/toModuleCallVariables'

// What replacing a directory's notes answers: their version now, which the next replacement names
export type SetDirectoryNotesAnswer = {
  id: string
  notesVersion: string
}

// How each operation refuses a note written since the module read it
const CHANGED_REFUSALS = ['The note changed since it was read', 'knowledge_note_pkey']

/*
  Replaces a directory's notes, for the member the agent acts as, with Markdown, `""` clearing them,
  as the page's editor would hold them. The id is held to the release's catalogue first, inactive
  directories included, then the notes are refused past their length, before anything is read. They
  are replaced only as the agent read them, the version `read_knowledge` gave, checked against the
  note read now and again in the write, guarded on when the note was written: one written since, by
  the page or another call, is refused, so nobody's words are written over unread. Notes the
  directory holds already write nothing
*/
async function setDirectoryNotes(
  caller: ModuleCaller,
  { id, notes, version }: { id: string; notes: string; version: string },
  call: ModuleCall | null,
): Promise<KnowledgeWriteResult<SetDirectoryNotesAnswer>> {
  if (!findKnowledgeEntry('DIRECTORY', id)) return { outcome: 'unknownItem', kind: 'DIRECTORY', id }

  const written = markdownToKnowledgeNote(notes)

  if (written.outcome === 'notesTooLong') return written

  const answered = await answerFromModuleCall(caller, call)

  if (answered) return answered

  const read = await readKnowledgeState(caller, 'DIRECTORY', [id])

  if (read.outcome !== 'read') return read

  const note = read.notes.get(id) ?? null
  const current = note?.content ?? ''

  if (hashKnowledgeNote(current) !== version) return { outcome: 'notesChanged' }
  if (written.content === current) return { outcome: 'unchanged', result: { id, notesVersion: version } }

  const result: SetDirectoryNotesAnswer = { id, notesVersion: hashKnowledgeNote(written.content) }
  const variables = {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
    kind: DatabaseKnowledgeKind.DIRECTORY,
    itemId: id,
    content: written.content,
    contentText: written.contentText,
    ...toModuleCallVariables(caller, call, result),
  }

  try {
    if (note) await updateKnowledgeNoteForAgent(dataConnect, { ...variables, updatedAt: note.updatedAt })
    else await createKnowledgeNoteForAgent(dataConnect, variables)

    return { outcome: 'written', result }
  } catch (error) {
    const answeredMeanwhile = isModuleCallKeyTaken(error) ? await answerFromModuleCall(caller, call) : null

    if (answeredMeanwhile) return answeredMeanwhile
    if (isOperationRefusal(error, NOT_MEMBER_REFUSAL)) return { outcome: 'notMember' }
    if (CHANGED_REFUSALS.some(refusal => isOperationRefusal(error, refusal))) return { outcome: 'notesChanged' }

    throw error
  }
}

export default setDirectoryNotes
