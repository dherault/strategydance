import {
  MAX_QUESTION_OPTIONS,
  MAX_QUESTION_OPTION_LENGTH,
  MAX_QUESTION_PROMPT_LENGTH,
  hasControlCharacter,
} from 'strategydance-core'
import { z } from 'zod'

const QUESTION_SCHEMA = z.object({
  prompt: z.string(),
  options: z.array(z.string()),
  multiple: z.boolean(),
})

// A question the agent asks, as the thread draws it
export type ConversationQuestion = {
  prompt: string
  options: string[]
  isMultipleChoice: boolean
}

/*
  Checks an `ask_user` call's input before anything of it is drawn, since its prompt and options go
  back into what Claude is sent exactly as they were written: a prompt of 1 to 1000 characters, 2 to
  6 distinct options of 1 to 200, each on one line, none holding a control character, U+0000
  included, or a line or paragraph separator. Lengths are
  counted in characters, as the database's check counts them. A call that fails is never asked:
  its result says why, from its input alone, so whoever answers the turn says the same
*/
function checkConversationQuestion(
  input: unknown,
): { outcome: 'valid'; question: ConversationQuestion } | { outcome: 'invalid'; reason: string } {
  const parsed = QUESTION_SCHEMA.safeParse(input)

  if (!parsed.success) {
    return invalid('it takes a prompt, a list of options and whether several may be chosen')
  }

  const { prompt, options, multiple } = parsed.data

  if (!prompt.trim() || countCharacters(prompt) > MAX_QUESTION_PROMPT_LENGTH) {
    return invalid(`its prompt holds 1 to ${MAX_QUESTION_PROMPT_LENGTH} characters`)
  }

  if (options.length < 2 || options.length > MAX_QUESTION_OPTIONS) {
    return invalid(`it offers 2 to ${MAX_QUESTION_OPTIONS} options`)
  }

  if (options.some(option => !option.trim() || countCharacters(option) > MAX_QUESTION_OPTION_LENGTH)) {
    return invalid(`each option holds 1 to ${MAX_QUESTION_OPTION_LENGTH} characters`)
  }

  if (new Set(options).size !== options.length) return invalid('its options are distinct')

  if ([prompt, ...options].some(text => hasControlCharacter(text) || /[\u2028\u2029]/.test(text))) {
    return invalid('its prompt and options hold no control characters, line breaks included')
  }

  return { outcome: 'valid', question: { prompt, options, isMultipleChoice: multiple } }
}

function invalid(rule: string) {
  return {
    outcome: 'invalid' as const,
    reason: `The question was not asked: ${rule}. Ask it again within those bounds.`,
  }
}

// In code points, as Postgres and the database's checks count a text
function countCharacters(text: string) {
  return [...text].length
}

export default checkConversationQuestion
