import { MAX_ANSWER_OTHER_LENGTH, MAX_CONVERSATION_PREVIEW_LENGTH } from '../constants'
import type {
  ConversationAnswer,
  ConversationAnswerCheck,
  ConversationPreview,
  ConversationPreviewSource,
} from '../types'

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

// How long a title built from a message is, its "…" included
const CONVERSATION_TITLE_CUT_LENGTH = 48

/*
  A conversation's title, from its first message: the message's plain text as its preview reads it,
  on one line, cut at a word's boundary to 48 characters with the "…" counted within them, so no
  title built from a message nears `MAX_CONVERSATION_TITLE_LENGTH`. The words are a word
  segmenter's, so a text written without spaces, as Chinese and Japanese are, is cut between words
  too, and a first word longer than the cut is cut between graphemes.

  A message the preview reads nothing of, a table alone say, is titled after its text as written.
  Empty only for a text with nothing to show, which the backend refuses before it comes here
*/
export function buildConversationTitle(text: string) {
  const line = getMarkdownPreviewText(text) || getPlainPreviewText(text)

  if (line.length <= CONVERSATION_TITLE_CUT_LENGTH) return line

  // Room for the "…"
  const length = CONVERSATION_TITLE_CUT_LENGTH - 1
  const cut = takeWords(line, length).trimEnd() || takeGraphemes(line, length).trimEnd()

  return `${cut}…`
}

/*
  The longest start of a text that ends between two words and fits in a length, or nothing when it
  holds no whole word, as when the first word is longer than the cut, behind an opening quote say.
  The segments are read lazily, so a long text is never segmented whole
*/
function takeWords(text: string, length: number) {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
  let cut = ''
  let hasWord = false

  for (const { segment, isWordLike } of segmenter.segment(text)) {
    if (cut.length + segment.length > length) break

    cut += segment
    hasWord ||= Boolean(isWordLike)
  }

  return hasWord ? cut : ''
}

// The longest start of a text that ends between two graphemes and fits in a length
function takeGraphemes(text: string, length: number) {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  let cut = ''

  for (const { segment } of segmenter.segment(text)) {
    if (cut.length + segment.length > length) break

    cut += segment
  }

  return cut
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
  ANSWERS
--- */

/*
  Whether a text holds a control character, U+0000 among them. A question's prompt and options and
  an answer's own words go back into what Claude is sent exactly as they were written, so one that
  holds any is refused rather than cleaned
*/
export function hasControlCharacter(text: string) {
  return /\p{Cc}/u.test(text)
}

/*
  Checks a member's answer against the question it answers, before anything is recorded, since it
  goes into what Claude is sent: the options chosen are distinct options of that question, one at
  most when a single one applies, the own words one line of at most `MAX_ANSWER_OTHER_LENGTH`
  characters once trimmed, without a control character, and the answer chooses something or says
  something. A single-choice answer is exactly one of the two, an option or its own words, as the
  radios draw it.

  A valid answer comes back with its options in the question's order and its own words trimmed, or
  null when there are none, so the same answer sent twice reads the same
*/
export function checkConversationAnswer(
  question: { options: string[]; isMultipleChoice: boolean },
  answer: ConversationAnswer,
): ConversationAnswerCheck {
  const other = answer.other?.trim() || null

  if (new Set(answer.selected).size !== answer.selected.length) {
    return { outcome: 'invalid', reason: 'An answer chooses each option once' }
  }

  if (answer.selected.some(option => !question.options.includes(option))) {
    return { outcome: 'invalid', reason: 'An answer chooses among the question’s options' }
  }

  if (other !== null) {
    if (other.length > MAX_ANSWER_OTHER_LENGTH) {
      return { outcome: 'invalid', reason: `An answer’s own words hold at most ${MAX_ANSWER_OTHER_LENGTH} characters` }
    }

    if (hasControlCharacter(other) || /[\u2028\u2029]/.test(other)) {
      return { outcome: 'invalid', reason: 'An answer’s own words are one line, without control characters' }
    }
  }

  const count = answer.selected.length + (other === null ? 0 : 1)

  if (!count) return { outcome: 'invalid', reason: 'An answer chooses an option or says something' }

  if (!question.isMultipleChoice && count > 1) {
    return { outcome: 'invalid', reason: 'A question with one answer takes one option or own words' }
  }

  return {
    outcome: 'valid',
    answer: { selected: question.options.filter(option => answer.selected.includes(option)), other },
  }
}

/* ---
  TEXT
--- */

// A line the preview leaves out: a code fence, a rule of three of one marker or more, or a
// heading's underline of equals signs or of hyphens, however few
const SKIPPED_LINE_PATTERN = /^(?:```|~~~|(?:-\s*){3,}$|(?:\*\s*){3,}$|(?:_\s*){3,}$|=+$|-+$)/

/*
  A table's delimiter row, under its header: cells of dashes, with colons for their alignment,
  split by pipes whose outer ones GFM makes optional. It holds one pipe at least, which tells it
  from a rule or a heading's underline
*/
const TABLE_DELIMITER_PATTERN = /^(?=.*\|)\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?$/

// A line that starts another block, a rule among them, which ends a table as a blank line does,
// and is never a table's header
const BLOCK_START_PATTERN =
  /^(?:#{1,6}(?:\s|$)|```|~~~|(?:[-*+]|\d{1,9}[.)])\s|(?:-\s*){3,}$|(?:\*\s*){3,}$|(?:_\s*){3,}$)/

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

    tableDepth = next?.depth === depth && isTableHeader(content, next.content) ? depth : null

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

/*
  Whether a line opens a table over the one under it, as GFM has it, and as the thread's own
  Markdown reads it: the line under is a delimiter row, neither starts another block, which
  `- | -` would as a list item, and both have as many cells
*/
function isTableHeader(line: string, nextLine: string) {
  return (
    Boolean(line)
    && TABLE_DELIMITER_PATTERN.test(nextLine)
    && !BLOCK_START_PATTERN.test(line)
    && !BLOCK_START_PATTERN.test(nextLine)
    && countTableCells(line) === countTableCells(nextLine)
  )
}

// A row's cells: one more than its pipes, the outer ones and the escaped ones aside
function countTableCells(row: string) {
  return row.replace(/\\./g, '').replace(/^\|/, '').replace(/\|$/, '').split('|').length
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
  // An autolink, to its address, a web or mail one or an email address alone
  [/<((?:https?|mailto):[^\s<>]*|[^\s<>@]+@[^\s<>@]+)>/g, '$1'],
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

/*
  What stands in for a code span while the rest of the markup is read, around the span's index:
  U+0000, which no pattern reads as a delimiter and a preview drops anyway, so the text loses it
  first and a mark can only be one
*/
const CODE_SPAN_MARK = '\u0000'

// The code spans first, set aside behind their marks so the patterns never read what they hold,
// then put back as written
function stripInlineMarkdown(text: string) {
  const codeSpans: string[] = []
  const marked = markCodeSpans(text.replaceAll(CODE_SPAN_MARK, ''), codeSpans)

  return INLINE_MARKUP_PATTERNS.reduce(
    (stripped, [pattern, replacement]) => stripped.replace(pattern, replacement),
    marked,
  )
    .split(CODE_SPAN_MARK)
    .map((part, index) => (index % 2 ? (codeSpans[Number(part)] ?? '') : part))
    .join('')
}

/*
  Each code span, replaced by a mark around its index in `codeSpans`, where its text goes, so
  emphasis around it is still found and nothing inside it is read as markup. As CommonMark has it,
  a run of backticks opens a span that the next run of the same length closes, so a longer run can
  hold shorter ones, and one that nothing closes stays as written. A backslash outside a span
  escapes the backtick after it, which leaves the rest of its run to open one; inside a span it
  escapes nothing, so it never keeps a run from closing it. Each run's closing one is looked up
  among the runs of its length rather than searched for, which keeps a message full of unpaired
  runs fast
*/
function markCodeSpans(text: string, codeSpans: string[]) {
  const runs = Array.from(text.matchAll(/`+/g), match => ({ start: match.index, end: match.index + match[0].length }))
  const runsByLength = new Map<number, number[]>()

  for (const [index, run] of runs.entries()) {
    const length = run.end - run.start
    const indexes = runsByLength.get(length)

    if (indexes) indexes.push(index)
    else runsByLength.set(length, [index])
  }

  let marked = ''
  let position = 0

  for (let index = 0; index < runs.length; index++) {
    const run = runs[index]
    const start = isEscaped(text, position, run.start) ? run.start + 1 : run.start
    const closingIndex = findIndexAfter(runsByLength.get(run.end - start), index)

    if (closingIndex === undefined) continue

    let code = text.slice(run.end, runs[closingIndex].start)

    // One space on each side is padding, which lets a span start or end with a backtick
    if (code.startsWith(' ') && code.endsWith(' ') && code.trim()) code = code.slice(1, -1)

    marked += `${text.slice(position, start)}${CODE_SPAN_MARK}${codeSpans.length}${CODE_SPAN_MARK}`
    codeSpans.push(code)
    position = runs[closingIndex].end
    index = closingIndex
  }

  return marked + text.slice(position)
}

/*
  Whether the character at `end` is escaped: an odd number of backslashes before it, since each
  pair is an escaped backslash. Those inside the code span `from` ends are not counted, as no
  backslash escapes anything there
*/
function isEscaped(text: string, from: number, end: number) {
  let count = 0

  while (end - count - 1 >= from && text[end - count - 1] === '\\') count++

  return count % 2 === 1
}

// The first of the ascending `indexes` past `index`, by bisection
function findIndexAfter(indexes: number[] | undefined, index: number) {
  if (!indexes) return undefined

  let low = 0
  let high = indexes.length

  while (low < high) {
    const middle = (low + high) >> 1

    if (indexes[middle] <= index) low = middle + 1
    else high = middle
  }

  return indexes[low]
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
