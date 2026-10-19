import { describe, expect, test } from 'bun:test'

import { CompanyAspect } from 'strategydance-database/backend'

import buildConversationTaggingRequest, { CONVERSATION_TAGGING_SCHEMA } from './buildConversationTaggingRequest'
import CONVERSATION_TAGGING_PROMPT from './taggingPrompt'

function readText(request: ReturnType<typeof buildConversationTaggingRequest>) {
  const [message] = request.messages
  const [block] = Array.isArray(message?.content) ? message.content : []

  return block?.type === 'text' ? block.text : ''
}

describe('buildConversationTaggingRequest', () => {
  test('asks Haiku 5.5 at low effort for the aspects, held to its schema, with no tools and no fallback', () => {
    const request = buildConversationTaggingRequest({ member: [], reply: [] })

    expect(request).toMatchObject({
      model: 'claude-haiku-5-5',
      max_tokens: 8000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: CONVERSATION_TAGGING_SCHEMA } },
      system: CONVERSATION_TAGGING_PROMPT,
    })
    expect(request).not.toHaveProperty('fallbacks')
    expect(request).not.toHaveProperty('betas')
    expect(request).not.toHaveProperty('tools')
    expect(request).not.toHaveProperty('thinking')
    expect(CONVERSATION_TAGGING_SCHEMA.properties.aspects.items.enum).toEqual(Object.values(CompanyAspect))
  })

  test('quotes the member’s message, then the reply’s text and the questions it asked', () => {
    const text = readText(
      buildConversationTaggingRequest({
        member: [{ type: 'text', text: 'Help me price the beta' }],
        reply: [
          { type: 'thinking', thinking: '', signature: 'abc' },
          { type: 'text', text: 'A few things first.' },
          { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'pricing' } },
          { type: 'tool_use', id: 'toolu_1', name: 'ask_user', input: { prompt: 'Who pays?', options: ['Teams'] } },
          { type: 'tool_use', id: 'toolu_2', name: 'list_tasks', input: { query: 'Pricing' } },
        ],
      }),
    )

    expect(text).toBe(
      [
        '<member_message>',
        'Help me price the beta',
        '</member_message>',
        '',
        '<strategy_dance_reply>',
        'A few things first.\n\nWho pays?',
        '</strategy_dance_reply>',
      ].join('\n'),
    )
  })

  test('cuts each side to 8000 characters, never inside one', () => {
    const text = readText(
      buildConversationTaggingRequest({
        member: [{ type: 'text', text: '👍'.repeat(9000) }],
        reply: [{ type: 'text', text: 'Short' }],
      }),
    )

    expect(text).toContain(`${'👍'.repeat(8000)}…\n</member_message>`)
    expect(text).not.toContain('👍'.repeat(8001))
    expect(text).toContain('<strategy_dance_reply>\nShort\n')
  })
})

describe('CONVERSATION_TAGGING_PROMPT', () => {
  test('names every aspect, and holds no em dash', () => {
    for (const aspect of Object.values(CompanyAspect)) expect(CONVERSATION_TAGGING_PROMPT).toContain(`- ${aspect}: `)

    expect(CONVERSATION_TAGGING_PROMPT).not.toContain('—')
    expect(CONVERSATION_TAGGING_PROMPT).not.toMatch(/[ \t]$/m)
  })
})
