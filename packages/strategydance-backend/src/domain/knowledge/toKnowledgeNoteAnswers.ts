import { getRichTextText } from 'strategydance-design-system/lib/getRichTextText'
import { parseRichText } from 'strategydance-design-system/lib/parseRichText'
import { getRichTextContentTypes, RICH_TEXT_NOTE_BLOCKS } from 'strategydance-design-system/lib/richText'
import { richTextToMarkdown } from 'strategydance-design-system/lib/richTextToMarkdown'

import cutToFit from '~utils/cutToFit'

import hashKnowledgeNote from '~domain/knowledge/hashKnowledgeNote'

export type KnowledgeNoteAnswer = {
  notes: string
  isNotesComplete: boolean
  notesVersion?: string
}

/*
  Notes as a read answers them, in the order given, within `room` characters of JSON for them all:
  each as Markdown with the version a replacement names, an empty string for an item never noted,
  the shortest first, each taking what it needs of an even share of what is left, so a short note is
  never cut for a long one's sake and a long one takes what the others leave. A note past its share
  comes as its plain text cut to fit, without a version, which the agent reads but cannot replace.
  Each note is parsed once, its plain text drawn only when it is cut
*/
function toKnowledgeNoteAnswers(contents: string[], room: number): KnowledgeNoteAnswer[] {
  const types = getRichTextContentTypes(RICH_TEXT_NOTE_BLOCKS)
  const notes = contents.map((content, index) => {
    const blocks = parseRichText(content, types)
    const markdown = richTextToMarkdown(blocks)

    return { index, content, blocks, markdown, length: JSON.stringify(markdown).length - 2 }
  })
  const answers: KnowledgeNoteAnswer[] = []
  let left = Math.max(0, room)

  for (const [position, note] of notes.toSorted((a, b) => a.length - b.length).entries()) {
    const share = Math.floor(left / (notes.length - position))

    if (note.length <= share) {
      answers[note.index] = {
        notes: note.markdown,
        isNotesComplete: true,
        notesVersion: hashKnowledgeNote(note.content),
      }
      left -= note.length

      continue
    }

    const text = cutToFit(getRichTextText(note.blocks), share)

    answers[note.index] = { notes: text, isNotesComplete: false }
    left -= JSON.stringify(text).length - 2
  }

  return answers
}

export default toKnowledgeNoteAnswers
