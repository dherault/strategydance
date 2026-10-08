import { describe, expect, test } from 'bun:test'

import { ConversationMessageKind, ConversationToolStatus } from 'strategydance-database/backend'

import buildConversationToolResults, { type ConversationCallMessage } from './buildConversationToolResults'
import {
  INTERRUPTED_CALL_RESULT,
  SKIPPED_QUESTION_RESULT,
  STOPPED_CALL_RESULT,
  toFailedOutput,
  toFailedResult,
  toSucceededResult,
} from './conversationToolResults'

const QUESTION_INPUT = { prompt: 'Which channel first?', options: ['X', 'LinkedIn'], multiple: true }

function call(id: string, name = 'read_log', input: unknown = {}) {
  return { id, name, input, block: 0 }
}

function message(toolUseId: string, fields: Partial<ConversationCallMessage>): ConversationCallMessage {
  return {
    kind: ConversationMessageKind.TOOL_CALL,
    toolUseId,
    toolStatus: ConversationToolStatus.RUNNING,
    toolOutput: null,
    toolStartedAt: null,
    answerSelected: null,
    answerOther: null,
    isAnswerSkipped: false,
    answeredAt: null,
    ...fields,
  }
}

function question(toolUseId: string, fields: Partial<ConversationCallMessage> = {}) {
  return message(toolUseId, { kind: ConversationMessageKind.QUESTION, toolStatus: null, ...fields })
}

describe('buildConversationToolResults', () => {
  test('answers every call in the turn’s order, whatever order they finished in', () => {
    const results = buildConversationToolResults({
      calls: [call('a'), call('b', 'ask_user', QUESTION_INPUT), call('c')],
      messages: [
        message('a', { toolStatus: ConversationToolStatus.SUCCEEDED }),
        question('b', { answerSelected: ['X'], answerOther: 'A newsletter', answeredAt: '2026-10-08T10:00:00Z' }),
        message('c', { toolStatus: ConversationToolStatus.SUCCEEDED }),
      ],
      pending: new Map([
        ['c', toSucceededResult('c', '{"entries":[]}')],
        ['a', toSucceededResult('a', '{"members":[]}')],
      ]),
      skipsQuestions: false,
    })

    expect(results).toEqual([
      toSucceededResult('a', '{"members":[]}'),
      toSucceededResult('b', '{"selected":["X"],"other":"A newsletter"}'),
      toSucceededResult('c', '{"entries":[]}'),
    ])
  })

  test('answers a question chosen without own words with the options alone', () => {
    const [result] = buildConversationToolResults({
      calls: [call('b', 'ask_user', QUESTION_INPUT)],
      messages: [question('b', { answerSelected: ['X', 'LinkedIn'], answeredAt: '2026-10-08T10:00:00Z' })],
      pending: new Map(),
      skipsQuestions: false,
    })

    expect(result?.content).toBe('{"selected":["X","LinkedIn"]}')
  })

  test('skips a question still waiting for a send, and refuses to answer it for anything else', () => {
    const input = { calls: [call('b', 'ask_user', QUESTION_INPUT)], messages: [question('b')], pending: new Map() }

    expect(buildConversationToolResults({ ...input, skipsQuestions: true })).toEqual([
      toSucceededResult('b', SKIPPED_QUESTION_RESULT),
    ])
    expect(() => buildConversationToolResults({ ...input, skipsQuestions: false })).toThrow()
  })

  test('answers a call refused when it was drawn with the sentence it shows', () => {
    const reason = 'Not run: a turn runs at most 10 calls. Call it again if you still need it.'
    const [result] = buildConversationToolResults({
      calls: [call('k')],
      messages: [message('k', { toolStatus: ConversationToolStatus.FAILED, toolOutput: toFailedOutput(reason) })],
      pending: new Map(),
      skipsQuestions: false,
    })

    expect(result).toEqual(toFailedResult('k', reason))
  })

  test('answers a call a stop kept from starting as stopped, and one a crash cut off as maybe run', () => {
    const results = buildConversationToolResults({
      calls: [call('cancelled'), call('started')],
      messages: [
        message('cancelled', { toolStatus: ConversationToolStatus.CANCELLED }),
        message('started', { toolStartedAt: '2026-10-08T10:00:00Z' }),
      ],
      pending: new Map(),
      skipsQuestions: true,
    })

    expect(results).toEqual([
      toFailedResult('cancelled', STOPPED_CALL_RESULT),
      toFailedResult('started', INTERRUPTED_CALL_RESULT),
    ])
  })

  test('answers a question past its bounds, which was never drawn, with why it was not asked', () => {
    const [result] = buildConversationToolResults({
      calls: [call('q', 'ask_user', { ...QUESTION_INPUT, options: ['X'] })],
      messages: [],
      pending: new Map(),
      skipsQuestions: true,
    })

    expect(result).toMatchObject({ is_error: true, content: expect.stringContaining('it offers 2 to 6 options') })
  })
})
