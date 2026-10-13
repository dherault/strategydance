import { MAX_CONVERSATION_MESSAGE_LENGTH } from 'strategydance-core'

// Half of a surrogate pair without the other, which no JSON column or request can carry as it is
const LONE_SURROGATE_PATTERN = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

type ParsedConversationMessageText =
  | { outcome: 'invalid'; reason: string }
  | {
      outcome: 'valid'
      // What the transcript keeps, exactly as sent
      text: string
      // What the thread draws, without U+0000, which a Postgres `text` column refuses
      drawnText: string
    }

/*
  A member's message as a send takes it, trimmed. Refused when it holds nothing to show, only
  whitespace, control and format characters such as a zero-width space, when it is not well-formed,
  and past `MAX_CONVERSATION_MESSAGE_LENGTH`. A message that sends files may hold nothing to show
  (`allowsEmpty`): its text is then empty, so its entry holds no text block, which Claude would refuse
*/
function parseConversationMessageText(
  rawText: string,
  { allowsEmpty = false }: { allowsEmpty?: boolean } = {},
): ParsedConversationMessageText {
  const text = rawText.trim()

  if (!text.replace(/[\p{Cc}\p{Cf}\s]/gu, '')) {
    return allowsEmpty
      ? { outcome: 'valid', text: '', drawnText: '' }
      : { outcome: 'invalid', reason: 'A message holds some text' }
  }

  if (LONE_SURROGATE_PATTERN.test(text)) return { outcome: 'invalid', reason: 'A message is well-formed text' }

  if (text.length > MAX_CONVERSATION_MESSAGE_LENGTH) {
    return { outcome: 'invalid', reason: `A message holds at most ${MAX_CONVERSATION_MESSAGE_LENGTH} characters` }
  }

  return { outcome: 'valid', text, drawnText: text.replaceAll('\u0000', '') }
}

export default parseConversationMessageText
