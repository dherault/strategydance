import { describe, expect, test } from 'bun:test'

import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import checkTranscript from './checkTranscript'

const member: BetaMessageParam = { role: 'user', content: [{ type: 'text', text: 'Price the beta' }] }
const context: BetaMessageParam = { role: 'system', content: [{ type: 'text', text: 'Context' }] }
const reply: BetaMessageParam = { role: 'assistant', content: [{ type: 'text', text: 'Flat 19 per month' }] }
const searching: BetaMessageParam = {
  role: 'assistant',
  content: [{ type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'beta' } }],
}
const calling: BetaMessageParam = {
  role: 'assistant',
  content: [
    { type: 'tool_use', id: 'toolu_1', name: 'read_knowledge', input: {} },
    { type: 'tool_use', id: 'toolu_2', name: 'get_team', input: {} },
  ],
}
const answering: BetaMessageParam = {
  role: 'user',
  content: [
    { type: 'tool_result', tool_use_id: 'toolu_1', content: 'A' },
    { type: 'tool_result', tool_use_id: 'toolu_2', content: 'B' },
    { type: 'text', text: 'And the beta?' },
  ],
}

function accepts(messages: BetaMessageParam[], isRequest = true) {
  expect(() => checkTranscript(messages, { isRequest })).not.toThrow()
}

function refuses(messages: BetaMessageParam[], isRequest = true) {
  expect(() => checkTranscript(messages, { isRequest })).toThrow('The transcript breaks a rule')
}

describe('checkTranscript', () => {
  test('accepts a first message, its context sent last until it is stored', () => {
    accepts([member, context])
    accepts([member])
  })

  test('accepts a stored turn and the next message with its own context', () => {
    accepts([member, context, reply], false)
    accepts([member, context, reply, member, context])
  })

  test('accepts a turn in parts, stored or held in memory after the context', () => {
    accepts([member, context, searching, reply], false)
    accepts([member, context, searching])
  })

  test('accepts calls answered in their order, and calls left unanswered last', () => {
    accepts([member, context, calling, answering, reply], false)
    accepts([member, context, calling], false)
  })

  test('refuses a transcript that does not open with the member’s entry', () => {
    refuses([reply, member])
    refuses([context, reply])
  })

  test('refuses a context message stored last, beside another or away from the member’s entry', () => {
    refuses([member, context], false)
    refuses([member, context, context, reply])
    refuses([member, context, reply, context, reply])
    refuses([member, context, member, reply])
  })

  test('refuses calls without their results right after, out of order, or after other words', () => {
    refuses([member, calling, reply])
    refuses([member, calling, member])
    refuses([
      member,
      calling,
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'toolu_2', content: 'B' },
          { type: 'tool_result', tool_use_id: 'toolu_1', content: 'A' },
        ],
      },
    ])
    refuses([
      member,
      calling,
      {
        role: 'user',
        content: [
          { type: 'text', text: 'First' },
          { type: 'tool_result', tool_use_id: 'toolu_1', content: 'A' },
          { type: 'tool_result', tool_use_id: 'toolu_2', content: 'B' },
        ],
      },
    ])
  })

  test('refuses unanswered calls anywhere but last', () => {
    refuses([member, calling, context, reply])
  })
})
