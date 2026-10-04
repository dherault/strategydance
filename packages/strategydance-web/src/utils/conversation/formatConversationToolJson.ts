/*
  Characters that would draw nothing, or draw what follows them elsewhere, which a tool's input and
  output show escaped so that what reads is what ran: `acct\u0000admin` never reads as `acctadmin`.
  The C0 controls are `JSON.stringify`'s to escape; these are the ones it leaves, DEL and the C1
  controls, and the marks that reorder text from right to left
*/
const HIDDEN_CHARACTERS = /[\u007f-\u009f‎‏‪-‮⁦-⁩]/g

// What a text that is not JSON escapes as well: every control but the line breaks and tabs it is laid
// out with, which is the point of the expression
// oxlint-disable-next-line no-control-regex
const HIDDEN_TEXT_CHARACTERS = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g

function escape(character: string) {
  return `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
}

/*
  A tool call's input or output, stored as JSON text, laid out to read in its dialog: indented two
  spaces, every control character escaped, in keys and nested values alike. The characters escaped
  only ever sit inside strings, so what shows is still the JSON that was stored. Text that does not
  parse is shown as it is, its controls escaped too
*/
function formatConversationToolJson(text: string | null | undefined) {
  if (text === null || text === undefined) return ''

  let value: unknown

  try {
    value = JSON.parse(text)
  } catch {
    return text.replace(HIDDEN_TEXT_CHARACTERS, escape)
  }

  return JSON.stringify(value, null, 2).replace(HIDDEN_CHARACTERS, escape)
}

export default formatConversationToolJson
