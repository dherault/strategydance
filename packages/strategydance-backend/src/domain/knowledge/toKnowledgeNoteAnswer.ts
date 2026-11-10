import cutToFit from '~utils/cutToFit'

import hashKnowledgeNote from '~domain/knowledge/hashKnowledgeNote'
import knowledgeNoteToMarkdown from '~domain/knowledge/knowledgeNoteToMarkdown'
import readKnowledgeNoteText from '~domain/knowledge/readKnowledgeNoteText'

export type KnowledgeNoteAnswer = {
  notes: string
  isNotesComplete: boolean
  notesVersion?: string
}

/*
  An item's notes as a read answers them, within the characters of JSON its share of the read
  allows: Markdown, with the version a replacement names, an empty string for an item never noted,
  or, past its share, their plain text cut to fit, without a version, which the agent reads but
  cannot replace until it reads the item alone
*/
function toKnowledgeNoteAnswer(content: string, budget: number): KnowledgeNoteAnswer {
  const markdown = knowledgeNoteToMarkdown(content)

  if (JSON.stringify(markdown).length - 2 <= budget) {
    return { notes: markdown, isNotesComplete: true, notesVersion: hashKnowledgeNote(content) }
  }

  return { notes: cutToFit(readKnowledgeNoteText(content), budget), isNotesComplete: false }
}

export default toKnowledgeNoteAnswer
