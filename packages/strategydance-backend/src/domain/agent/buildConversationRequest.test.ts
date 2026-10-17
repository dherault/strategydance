import { describe, expect, test } from 'bun:test'

import { ConversationTranscriptRole } from 'strategydance-database/backend'

import CONVERSATION_TOOLS from '~domain/agent/conversationTools'
import CONVERSATION_SYSTEM_PROMPT from '~domain/agent/systemPrompt'

import buildConversationRequest, { buildConversationMessages } from './buildConversationRequest'

// Keys out of alphabetical order, and U+0000 escaped, as a stored entry holds them
const MEMBER = JSON.stringify([{ type: 'text', text: 'Price the beta\u0000' }])
const CONTEXT = [{ type: 'text' as const, text: 'Context from Strategy Dance' }]
const REPLY = JSON.stringify([
  { type: 'thinking', thinking: '', signature: 'sig' },
  { type: 'text', text: 'Flat 19 per month', citations: null },
])

const CONFIG = { system: CONVERSATION_SYSTEM_PROMPT, tools: CONVERSATION_TOOLS }

describe('buildConversationMessages', () => {
  test('replays the stored entries, then the unstored context, then the paused parts held in memory', () => {
    const messages = buildConversationMessages({
      entries: [{ role: ConversationTranscriptRole.USER, content: MEMBER }],
      context: CONTEXT,
      parts: [[{ type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'beta' } }]],
    })

    expect(messages.map(({ role }) => role)).toEqual(['user', 'system', 'assistant'])
    expect(JSON.stringify(messages[0]?.content)).toBe(MEMBER)
    expect(messages[1]?.content).toEqual(CONTEXT)
  })

  test('sends a stored context as a system message, in its place', () => {
    const messages = buildConversationMessages({
      entries: [
        { role: ConversationTranscriptRole.USER, content: MEMBER },
        { role: ConversationTranscriptRole.SYSTEM, content: JSON.stringify(CONTEXT) },
        { role: ConversationTranscriptRole.ASSISTANT, content: REPLY },
      ],
      context: null,
      parts: [],
    })

    expect(messages.map(({ role }) => role)).toEqual(['user', 'system', 'assistant'])
    expect(JSON.stringify(messages[2]?.content)).toBe(REPLY)
  })
})

describe('buildConversationRequest', () => {
  test('asks Opus 5.5 as the probe settled, with web search, its questions, its integrations and the system prompt cached', () => {
    const request = buildConversationRequest([{ role: 'user', content: 'Hello' }], CONFIG)

    expect(request).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 64000,
      betas: [
        'thinking-display-updates-2026-08-18',
        'thinking-binding-controls-2026-08-01',
        'server-side-fallback-2026-07-01',
      ],
      thinking: { type: 'adaptive', display: 'updates', block_binding: { prefix_mismatch_behavior: 'drop_block' } },
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      cache_control: { type: 'ephemeral' },
      tools: [
        { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
        { name: 'ask_user', strict: true, eager_input_streaming: true },
        { name: 'list_integrations', strict: true, eager_input_streaming: true },
        { name: 'describe_integration_tool', strict: true, eager_input_streaming: true },
        { name: 'call_integration_tool', eager_input_streaming: true },
      ],
    })
    expect(request.system).toEqual([
      { type: 'text', text: CONVERSATION_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ])
  })

  test('asks a subagent’s own model at its own effort, with a task budget and its beta when it has one', () => {
    const request = buildConversationRequest([{ role: 'user', content: 'Hello' }], {
      ...CONFIG,
      settings: { model: 'claude-sonnet-5-5', effort: 'low', taskBudget: 60000 },
    })

    expect(request).toMatchObject({
      model: 'claude-sonnet-5-5',
      betas: [
        'thinking-display-updates-2026-08-18',
        'thinking-binding-controls-2026-08-01',
        'server-side-fallback-2026-07-01',
        'task-budgets-2026-03-13',
      ],
      output_config: { effort: 'low', task_budget: { type: 'tokens', total: 60000 } },
    })
    expect(buildConversationRequest([], { ...CONFIG, settings: undefined }).output_config).toEqual({ effort: 'medium' })
  })

  test('builds the next request as the last one’s bytes, then what follows', () => {
    const first = JSON.stringify(
      buildConversationRequest(
        buildConversationMessages({
          entries: [{ role: ConversationTranscriptRole.USER, content: MEMBER }],
          context: CONTEXT,
          parts: [],
        }),
        CONFIG,
      ),
    )
    const next = JSON.stringify(
      buildConversationRequest(
        buildConversationMessages({
          entries: [
            { role: ConversationTranscriptRole.USER, content: MEMBER },
            { role: ConversationTranscriptRole.SYSTEM, content: JSON.stringify(CONTEXT) },
            { role: ConversationTranscriptRole.ASSISTANT, content: REPLY },
            { role: ConversationTranscriptRole.USER, content: MEMBER },
          ],
          context: CONTEXT,
          parts: [],
        }),
        CONFIG,
      ),
    )

    // The first request ends with its messages' closing bracket and the body's
    expect(next.startsWith(first.slice(0, -2))).toBe(true)
  })
})
