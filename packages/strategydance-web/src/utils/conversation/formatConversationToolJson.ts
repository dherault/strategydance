/*
  Characters that would draw nothing, or draw what follows them elsewhere, which a tool's input and
  output show escaped so that what reads is what ran: `acct\u0000admin` never reads as `acctadmin`.
  JSON text holds no raw C0 control, which it must escape itself; these are the ones it may hold
  raw inside a string: DEL and the C1 controls, the line and paragraph separators, and the marks
  that reorder text from right to left
*/
const HIDDEN_CHARACTERS = /[\u007f-\u009f\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g

// What a text that is not JSON escapes as well: every control but the line breaks and tabs it is laid
// out with, which is the point of the expression
const HIDDEN_TEXT_CHARACTERS =
  // oxlint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g

function escape(character: string) {
  return `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
}

// The whitespace JSON allows between its tokens, which the layout replaces with its own
function isJsonWhitespace(character: string | undefined) {
  return character === ' ' || character === '\t' || character === '\n' || character === '\r'
}

/*
  Lays valid JSON text out as `JSON.stringify(value, null, 2)` would, but token by token, never
  through a value: a number keeps every digit it was written with, `1e400` stays `1e400`, and a key
  written twice stays twice, where parsing would round the first, turn the second into `null` and
  keep one of the third
*/
function layOut(text: string) {
  let laidOut = ''
  let depth = 0
  let index = 0

  function breakLine() {
    return `\n${'  '.repeat(depth)}`
  }

  while (index < text.length) {
    const character = text[index]!

    if (character === '"') {
      let end = index + 1

      while (end < text.length && text[end] !== '"') end += text[end] === '\\' ? 2 : 1

      laidOut += text.slice(index, end + 1)
      index = end + 1
    } else if (isJsonWhitespace(character)) {
      index += 1
    } else if (character === '{' || character === '[') {
      let next = index + 1

      while (isJsonWhitespace(text[next])) next += 1

      // An empty object or array stays on its line
      if (text[next] === (character === '{' ? '}' : ']')) {
        laidOut += character + text[next]
        index = next + 1
      } else {
        depth += 1
        laidOut += character + breakLine()
        index += 1
      }
    } else if (character === '}' || character === ']') {
      depth -= 1
      laidOut += breakLine() + character
      index += 1
    } else if (character === ',') {
      laidOut += `,${breakLine()}`
      index += 1
    } else if (character === ':') {
      laidOut += ': '
      index += 1
    } else {
      laidOut += character
      index += 1
    }
  }

  return laidOut
}

/*
  A tool call's input or output, stored as JSON text, laid out to read in its dialog: indented two
  spaces, exactly the values stored, every control character escaped, in keys and nested values
  alike. The characters escaped only ever sit inside strings, so what shows, and what Copy takes,
  is still JSON for the same value. Text that does not parse is shown as it is, its controls
  escaped too
*/
function formatConversationToolJson(text: string | null | undefined) {
  if (text === null || text === undefined) return ''

  try {
    // Only to know it is JSON: the layout never goes through what it parses to
    JSON.parse(text)
  } catch {
    return text.replace(HIDDEN_TEXT_CHARACTERS, escape)
  }

  return layOut(text).replace(HIDDEN_CHARACTERS, escape)
}

export default formatConversationToolJson
