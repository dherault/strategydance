// What in a text micromark, under `react-markdown`, reads in time growing faster than its length
export type MarkdownHazards = {
  // Opening and closing square brackets
  brackets: number
  // List markers opening a line, those nested on one line counted each, as in `- - a`
  listMarkers: number
  // The most quote markers opening one line, as in `>>> a`
  quoteDepth: number
  // The longest run of asterisks or underscores, which emphasis is read from
  emphasisRun: number
}

/*
  How far `Markdown` draws a text as Markdown, measured on 2026-10-18 by drawing the shapes
  `markdownToRichText`'s tests hold to a document's length, at a piece's 20000 characters, through
  `renderToStaticMarkup` in React's development build on a laptop: quote markers opening one line
  took 678 ms at 1200 and 29 seconds at 5000, a run of asterisks overflowed the stack at 6000 each
  side, and 6700 closing brackets or 13000 list markers took half a second. Every shape held to
  these took under 200 ms, which a phone takes a few times longer over, and no reply written for a
  reader comes near them
*/
export const MARKDOWN_HAZARD_LIMITS: MarkdownHazards = {
  brackets: 2000,
  listMarkers: 2000,
  quoteDepth: 100,
  emphasisRun: 200,
}

/*
  Counts what micromark is slow on, in one pass: brackets and the longest run of asterisks or
  underscores anywhere, and at the start of each line, past its indentation, the quote markers and
  list markers opening it, bulleted or numbered, nested ones included. It counts generously, a dash
  opening a line of prose as a marker, since all it decides is whether a text is drawn as
  Markdown at all
*/
function countMarkdownHazards(text: string): MarkdownHazards {
  const hazards: MarkdownHazards = { brackets: 0, listMarkers: 0, quoteDepth: 0, emphasisRun: 0 }
  let run = 0
  let runCharacter = ''
  let isLineStart = true
  let lineQuotes = 0

  for (let index = 0; index < text.length; index++) {
    const character = text[index]

    if (character === '*' || character === '_') {
      run = character === runCharacter ? run + 1 : 1
      runCharacter = character
      hazards.emphasisRun = Math.max(hazards.emphasisRun, run)
    } else {
      run = 0
      runCharacter = ''
    }

    if (character === '[' || character === ']') hazards.brackets++

    if (character === '\n' || character === '\r') {
      isLineStart = true
      lineQuotes = 0

      continue
    }

    if (!isLineStart || character === ' ' || character === '\t') continue

    if (character === '>') {
      lineQuotes++
      hazards.quoteDepth = Math.max(hazards.quoteDepth, lineQuotes)

      continue
    }

    if ((character === '-' || character === '*' || character === '+') && isSpace(text[index + 1])) {
      hazards.listMarkers++

      continue
    }

    const numberEnd = readOrderedMarkerEnd(text, index)

    if (numberEnd !== null) {
      hazards.listMarkers++
      index = numberEnd

      continue
    }

    isLineStart = false
  }

  return hazards
}

// Whether a text is within every limit `Markdown` draws Markdown to
export function isWithinMarkdownHazardLimits(text: string) {
  const hazards = countMarkdownHazards(text)

  return (Object.keys(MARKDOWN_HAZARD_LIMITS) as (keyof MarkdownHazards)[]).every(
    hazard => hazards[hazard] <= MARKDOWN_HAZARD_LIMITS[hazard],
  )
}

// Where a numbered list's marker opening at `index` ends, `1.` or `1)` before a space, at most nine
// digits as CommonMark has it, or null when none opens there
function readOrderedMarkerEnd(text: string, index: number) {
  let end = index

  while (end - index < 9 && isDigit(text[end])) end++

  if (end === index || (text[end] !== '.' && text[end] !== ')') || !isSpace(text[end + 1])) return null

  return end
}

function isDigit(character: string | undefined) {
  return character !== undefined && character >= '0' && character <= '9'
}

function isSpace(character: string | undefined) {
  return character === ' ' || character === '\t'
}

export default countMarkdownHazards
