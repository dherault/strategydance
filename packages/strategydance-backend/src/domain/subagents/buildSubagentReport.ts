import { MAX_SUBAGENT_REPORT_LENGTH } from 'strategydance-core'
import { ConversationNoteKind, ConversationRunStatus, ConversationTranscriptRole } from 'strategydance-database/backend'

import type { ConversationRunEnding } from '~domain/conversations/endConversationRun'
import parseTranscriptContent from '~domain/conversations/parseTranscriptContent'
import readConversationText, { isConversationTextBlock } from '~domain/conversations/readConversationText'

// What a subagent that completed and wrote nothing reports
const SILENT_REPORT = 'This subagent finished without writing a report.'

/*
  A subagent's report, as the mutation that ends its run writes it: its last reply, the last text it
  drew, its pieces joined, cut to 8000 characters (`MAX_SUBAGENT_REPORT_LENGTH`) at the last line
  break or space before them, and marked cut with an ellipsis. A run that did not complete leads it
  with a sentence saying how it ended, the text following within the 8000, and one that wrote nothing
  reports how it ended alone.

  The text is read from the transcript's replies alone, never the brief or a context message, which
  hold text too, and a fallback's boundary between two texts joins them, as the thread draws them
*/
function buildSubagentReport(
  ending: ConversationRunEnding,
  entries: { role: ConversationTranscriptRole; content: string }[],
) {
  const sentence = describeEnding(ending)
  const text = readLastText(entries)

  if (!text) return sentence ?? SILENT_REPORT
  if (!sentence) return cut(text, MAX_SUBAGENT_REPORT_LENGTH)

  return `${sentence}\n\n${cut(text, MAX_SUBAGENT_REPORT_LENGTH - sentence.length - 2)}`
}

// How a run that did not complete ended, as its report says first, or nothing for one that did
function describeEnding(ending: ConversationRunEnding) {
  if (ending.kind === 'interrupted') return 'This subagent was interrupted before it finished.'
  if (ending.kind === 'waiting') return null

  if (ending.kind === 'finished') {
    return ending.status === ConversationRunStatus.COMPLETED ? null : 'This subagent was stopped before it finished.'
  }

  switch (ending.noteKind) {
    case ConversationNoteKind.FAILED:
      return ending.isAtLimit
        ? 'This subagent stopped at its limits before it finished.'
        : 'This subagent failed before it finished.'
    case ConversationNoteKind.FULL:
      return 'This subagent stopped before it finished: its conversation was full.'
    case ConversationNoteKind.STOPPED:
      return 'This subagent was stopped before it finished.'
    case ConversationNoteKind.REFUSED:
      return 'This subagent stopped before it finished: Claude declined to go on.'
  }
}

// The last text run of the latest reply holding one
function readLastText(entries: { role: ConversationTranscriptRole; content: string }[]) {
  for (const entry of [...entries].reverse()) {
    if (entry.role !== ConversationTranscriptRole.ASSISTANT) continue

    const blocks = parseTranscriptContent(entry.content)
    let last: ReturnType<typeof readConversationText> | null = null

    for (let index = 0; index < blocks.length;) {
      if (!isConversationTextBlock(blocks[index])) {
        index++

        continue
      }

      const run = readConversationText(blocks, index)

      if (run.text) last = run

      index = Math.max(run.toBlock, index + 1)
    }

    if (last) return last.text
  }

  return null
}

/*
  A text within a length, whole when it fits, and otherwise cut at its last line break, or else its
  last space, in the second half of the room, or else at its last whole grapheme, never splitting a
  character or a cluster, then marked cut with an ellipsis
*/
function cut(text: string, maxLength: number) {
  if (text.length <= maxLength) return text

  // Room for the "…"
  const room = maxLength - 1
  let end = 0

  for (const { index, segment } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) {
    if (index + segment.length > room) break

    end = index + segment.length
  }

  const head = text.slice(0, end)
  const lineBreak = head.lastIndexOf('\n')
  const space = head.lastIndexOf(' ')
  const at = lineBreak > room / 2 ? lineBreak : space > room / 2 ? space : end

  return `${head.slice(0, at).trimEnd()}…`
}

export default buildSubagentReport
