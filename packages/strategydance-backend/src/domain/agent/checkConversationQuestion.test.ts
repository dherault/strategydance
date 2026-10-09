import { describe, expect, test } from 'bun:test'

import { MAX_QUESTION_OPTION_LENGTH, MAX_QUESTION_PROMPT_LENGTH } from 'strategydance-core'

import checkConversationQuestion from './checkConversationQuestion'

const NUL = String.fromCharCode(0)

function question(overrides: Record<string, unknown> = {}) {
  return { prompt: 'Which price should the beta start at?', options: ['€19', '€29'], multiple: false, ...overrides }
}

describe('checkConversationQuestion', () => {
  test('takes a question within its bounds, as written', () => {
    expect(checkConversationQuestion(question({ multiple: true }))).toEqual({
      outcome: 'valid',
      question: { prompt: 'Which price should the beta start at?', options: ['€19', '€29'], isMultipleChoice: true },
    })
  })

  test('takes a prompt and an option at their bounds, and refuses either a character past it', () => {
    const prompt = 'a'.repeat(MAX_QUESTION_PROMPT_LENGTH)
    const option = 'b'.repeat(MAX_QUESTION_OPTION_LENGTH)

    expect(checkConversationQuestion(question({ prompt, options: [option, 'c'] })).outcome).toBe('valid')
    expect(checkConversationQuestion(question({ prompt: `${prompt}a` })).outcome).toBe('invalid')
    expect(checkConversationQuestion(question({ options: [`${option}b`, 'c'] })).outcome).toBe('invalid')
  })

  test('counts an emoji as one character, as the database does', () => {
    const prompt = '🎉'.repeat(MAX_QUESTION_PROMPT_LENGTH)

    expect(checkConversationQuestion(question({ prompt })).outcome).toBe('valid')
  })

  test('refuses fewer than 2 options, more than 6, an empty one and one offered twice', () => {
    for (const options of [['Only'], ['1', '2', '3', '4', '5', '6', '7'], ['A', ' '], ['A', 'A']]) {
      expect(checkConversationQuestion(question({ options })).outcome).toBe('invalid')
    }
  })

  test('refuses a prompt or an option holding a control character, U+0000 included, or a line separator', () => {
    for (const overrides of [
      { prompt: `Which${NUL} price?` },
      { prompt: 'Which\nprice?' },
      { options: [`€19${NUL}`, '€29'] },
      { options: ['€19', '€\t29'] },
      { prompt: `Which${String.fromCharCode(0x2028)}price?` },
      { options: [`€19${String.fromCharCode(0x2029)}`, '€29'] },
    ]) {
      expect(checkConversationQuestion(question(overrides)).outcome).toBe('invalid')
    }
  })

  test('refuses an input of another shape, and says why in a sentence Claude can act on', () => {
    const checked = checkConversationQuestion({ prompt: 'Which?', options: 'A or B' })

    expect(checked).toEqual({
      outcome: 'invalid',
      reason:
        'The question was not asked: it takes a prompt, a list of options and whether several may be chosen. Ask it again within those bounds.',
    })
  })
})
