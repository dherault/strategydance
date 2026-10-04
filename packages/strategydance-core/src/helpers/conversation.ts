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

// A line the preview leaves out: a code fence, a rule, or a heading's underline
const SKIPPED_LINE_PATTERN = /^(?:```|~~~|(?:[-*_]\s*){3,}$|=+$)/

/*
  A table's delimiter row, under its header: cells of dashes, with colons for their alignment,
  split by pipes whose outer ones GFM makes optional. It holds one pipe at least, which tells it
  from a rule or a heading's underline
*/
const TABLE_DELIMITER_PATTERN = /^(?=.*\|)\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?$/

// A line that starts another block, which ends a table as a blank line does, and is never a
// table's header
const BLOCK_START_PATTERN = /^(?:#{1,6}(?:\s|$)|```|~~~|(?:[-*+]|\d{1,9}[.)])\s)/

const QUOTE_MARKER_PATTERN = /^(?:>\s*)+/

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
  const lines = markdown.split(/\r\n?|\n/).map(readQuotedLine)
  let text = ''
  // The line before, tested rather than the whole text, which would make a long list quadratic
  let previousLine = ''
  // How deep in quotes the table being left out sits, and null outside one
  let tableDepth: number | null = null

  for (let index = 0; index < lines.length; index++) {
    const { depth, content } = lines[index]

    // A table runs from its header, the line above its delimiter row, to a blank line, another
    // block or another depth of quote, and every row in between is one, with a pipe or without
    if (depth === tableDepth && content && !BLOCK_START_PATTERN.test(content)) continue

    const next = lines[index + 1]

    tableDepth =
      content.includes('|')
      && !BLOCK_START_PATTERN.test(content)
      && next?.depth === depth
      && TABLE_DELIMITER_PATTERN.test(next.content)
        ? depth
        : null

    if (tableDepth !== null) {
      index++

      continue
    }

    let line = content

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

// A line without its quote markers, and how many it had
function readQuotedLine(line: string) {
  const trimmed = line.trim()
  const quote = QUOTE_MARKER_PATTERN.exec(trimmed)?.[0] ?? ''

  return { depth: quote.split('>').length - 1, content: trimmed.slice(quote.length) }
}

/*
  Inline markup, to the text it marks up, in this order, after the code spans. Each pattern stops
  at the next delimiter rather than looking past it for a closing one, so a message full of
  unpaired ones costs no more to read than any other
*/
const INLINE_MARKUP_PATTERNS: [RegExp, string][] = [
  // A link or an image, to its label, a knowledge mention's title included. An escaped bracket
  // opens none, and neither part reads past the next bracket that would open another, but for
  // one pair of parentheses in the address, as an address like `Function_(mathematics)` holds
  [/(?<!\\)!?\[((?:\\.|[^\\[\]])*)\]\((?:\\.|[^\\()]|\((?:\\.|[^\\()])*\))*\)/g, '$1'],
  // An autolink, to its address
  [/<((?:https?|mailto):[^\s<>]*)>/g, '$1'],
  // Strong emphasis and strikethrough, which may wrap single delimiters of their own, as
  // **bold *italic* text** does, and stop at the next double one. The single ones come after
  [/(?<!\\)\*\*(?=[^*\s])((?:[^*]|\*(?!\*))*?[^*\s])\*\*/g, '$1'],
  [/(?<![\\\w])__(?=[^_\s])((?:[^_]|_(?!_))*?[^_\s])__(?!\w)/g, '$1'],
  [/(?<!\\)~~(?=[^~\s])((?:[^~]|~(?!~))*?[^~\s])~~/g, '$1'],
  [/(?<![\\*\w])\*([^*\s](?:[^*]*[^*\s])?)\*(?![*\w])/g, '$1'],
  // Never inside a word, so `read_knowledge` keeps its underscore
  [/(?<![\\\w])_([^_\s](?:[^_]*[^_\s])?)_(?!\w)/g, '$1'],
  // An escaped character, to itself: CommonMark escapes ASCII punctuation alone
  [/\\([!-/:-@[-`{-~])/g, '$1'],
]

function stripInlineMarkdown(text: string) {
  return INLINE_MARKUP_PATTERNS.reduce(
    (stripped, [pattern, replacement]) => stripped.replace(pattern, replacement),
    stripCodeSpans(text),
  )
}

// A run of backticks no backslash escapes
const BACKTICK_RUN_PATTERN = /(?<!\\)`+/g

/*
  Code spans, to their text, first, so emphasis around one is still found. As CommonMark has it, a
  run of backticks opens a span that the next run of the same length closes, so a longer run can
  hold shorter ones, and one that nothing closes stays as written. Each run's closing one is found
  in a single pass from the end, rather than by searching past it, which keeps a message full of
  unpaired runs linear
*/
function stripCodeSpans(text: string) {
  const runs = Array.from(text.matchAll(BACKTICK_RUN_PATTERN), match => ({
    start: match.index,
    end: match.index + match[0].length,
  }))
  const closingRuns: (number | undefined)[] = []
  const nextRunOfLength = new Map<number, number>()

  for (let index = runs.length - 1; index >= 0; index--) {
    const length = runs[index].end - runs[index].start

    closingRuns[index] = nextRunOfLength.get(length)
    nextRunOfLength.set(length, index)
  }

  let stripped = ''
  let position = 0

  for (let index = 0; index < runs.length; index++) {
    const closingIndex = closingRuns[index]

    if (closingIndex === undefined) continue

    let code = text.slice(runs[index].end, runs[closingIndex].start)

    // One space on each side is padding, which lets a span start or end with a backtick
    if (code.startsWith(' ') && code.endsWith(' ') && code.trim()) code = code.slice(1, -1)

    stripped += text.slice(position, runs[index].start) + code
    position = runs[closingIndex].end
    index = closingIndex
  }

  return stripped + text.slice(position)
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
