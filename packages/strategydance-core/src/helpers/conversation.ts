import { MAX_CONVERSATION_PREVIEW_LENGTH } from '../constants'
import type { ConversationPreview, ConversationPreviewSource } from '../types'

/*
  What the conversations list and the aspect page's cards show of a conversation: its last entry,
  boiled down by whoever inserts or changes that entry and stored on the conversation, so the list
  reads no message text. It keeps the entry's facts and leaves the words to the web, which says
  "You: …" or "Question: …" in the reader's language. "Thinking…" and "No messages yet" are the
  web's too, read from the conversation's run and from a preview that is not there.

  An aspects note is never the preview: null tells the caller to keep the one before it
*/
export function buildConversationPreview(source: ConversationPreviewSource): ConversationPreview | null {
  switch (source.kind) {
    case 'MEMBER_TEXT':
    case 'AGENT_TEXT':
      return { kind: source.kind, text: getMarkdownPreviewText(source.text ?? '') }
    case 'TOOL_CALL':
      if (!source.toolName || !source.toolStatus) throw new Error('A tool call needs its name and status')

      return { kind: source.kind, toolName: source.toolName, toolStatus: source.toolStatus }
    case 'QUESTION':
      return buildQuestionPreview(source)
    case 'NOTE':
      if (!source.noteKind) throw new Error('A note needs its kind')

      return { kind: source.kind, noteKind: source.noteKind }
    case 'ASPECTS':
      return null
  }
}

// A question shows its prompt until it is answered, and then the answer: the options chosen, then
// the member's own words, in the order the thread ticks them
function buildQuestionPreview(source: ConversationPreviewSource): ConversationPreview {
  const prompt = getPlainPreviewText(source.questionPrompt ?? '')

  if (source.isAnswerSkipped) return { kind: 'QUESTION', questionState: 'SKIPPED', text: prompt }

  const answers = [...(source.answerSelected ?? []), source.answerOther ?? '']
    .map(answer => answer.trim())
    .filter(Boolean)

  if (!answers.length) return { kind: 'QUESTION', questionState: 'WAITING', text: prompt }

  return { kind: 'QUESTION', questionState: 'ANSWERED', text: getPlainPreviewText(answers.join(', ')) }
}

/* ---
  TEXT
--- */

// A line the preview leaves out: a table's row, a code fence, a rule, or a heading's underline
const SKIPPED_LINE_PATTERN = /^(?:\||```|~~~|(?:[-*_]\s*){3,}$|=+$)/

const QUOTE_MARKER_PATTERN = /^(?:>\s?)+/

const HEADING_MARKER_PATTERN = /^#{1,6}(?:\s+|$)/

// A bullet or a number, and a check item's box after it
const LIST_MARKER_PATTERN = /^(?:[-*+]|\d{1,9}[.)])\s+(?:\[[ xX]\]\s+)?/

// What a list follows without a comma: a line ending on a colon, maybe inside emphasis
const INTRODUCTION_END_PATTERN = /:[*_~`]*$/

/*
  A message's Markdown as one line of plain text, as the design's list draws it: tables, fences
  and rules left out, a list's items joined by commas, the rest of the lines by spaces, and the
  inline markup down to its text
*/
function getMarkdownPreviewText(markdown: string) {
  let text = ''
  // The line before, tested rather than the whole text, which would make a long list quadratic
  let previousLine = ''

  for (const rawLine of markdown.split(/\r\n?|\n/)) {
    let line = rawLine.trim().replace(QUOTE_MARKER_PATTERN, '')

    if (!line || SKIPPED_LINE_PATTERN.test(line)) continue

    if (HEADING_MARKER_PATTERN.test(line)) line = line.replace(HEADING_MARKER_PATTERN, '').replace(/\s+#+$/, '')

    const isListItem = LIST_MARKER_PATTERN.test(line)

    if (isListItem) line = line.replace(LIST_MARKER_PATTERN, '')
    if (!line) continue

    if (!text) text = line
    else if (isListItem && !INTRODUCTION_END_PATTERN.test(previousLine)) text += `, ${line}`
    else text += ` ${line}`

    previousLine = line
  }

  return getPlainPreviewText(stripInlineMarkdown(text))
}

/*
  Inline markup, to the text it marks up, in this order. Each pattern stops at the next delimiter
  rather than looking past it for a closing one, so a message full of unpaired ones costs no more
  to read than any other
*/
const INLINE_MARKUP_PATTERNS: [RegExp, string][] = [
  // A code span, to its text, first, so emphasis around it is still found
  [/(`+)([^`]*)\1/g, '$2'],
  // A link or an image, to its label, a knowledge mention's title included. An escaped bracket
  // opens none, and neither part reads past the next bracket that would open another
  [/(?<!\\)!?\[((?:\\.|[^\\[\]])*)\]\((?:\\.|[^\\()])*\)/g, '$1'],
  // An autolink, to its address
  [/<((?:https?|mailto):[^\s<>]*)>/g, '$1'],
  [/(?<!\\)\*\*([^*\s](?:[^*]*[^*\s])?)\*\*/g, '$1'],
  [/(?<![\\\w])__([^_\s](?:[^_]*[^_\s])?)__(?!\w)/g, '$1'],
  [/(?<!\\)~~([^~\s](?:[^~]*[^~\s])?)~~/g, '$1'],
  [/(?<![\\*\w])\*([^*\s](?:[^*]*[^*\s])?)\*(?![*\w])/g, '$1'],
  // Never inside a word, so `read_knowledge` keeps its underscore
  [/(?<![\\\w])_([^_\s](?:[^_]*[^_\s])?)_(?!\w)/g, '$1'],
  // An escaped character, to itself: CommonMark escapes ASCII punctuation alone
  [/\\([!-/:-@[-`{-~])/g, '$1'],
]

function stripInlineMarkdown(text: string) {
  return INLINE_MARKUP_PATTERNS.reduce(
    (stripped, [pattern, replacement]) => stripped.replace(pattern, replacement),
    text,
  )
}

/*
  Text as the preview stores it: on one line, without the control characters that are not
  whitespace, U+0000 among them, which `jsonb` refuses, and cut to its length
*/
function getPlainPreviewText(text: string) {
  const line = text
    .replace(/\p{Cc}/gu, character => (/\s/.test(character) ? ' ' : ''))
    .replace(/\s+/g, ' ')
    .trim()

  return cutPreviewText(line)
}

/*
  Cut at a grapheme's boundary, so an emoji or a letter and its accent is never split in two, and
  the "…" counted within the length. The segments are read lazily, so a long reply is never
  segmented whole
*/
function cutPreviewText(text: string) {
  if (text.length <= MAX_CONVERSATION_PREVIEW_LENGTH) return text

  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  let cut = ''

  for (const { segment } of segmenter.segment(text)) {
    if (cut.length + segment.length >= MAX_CONVERSATION_PREVIEW_LENGTH) break

    cut += segment
  }

  return `${cut.trimEnd()}…`
}
