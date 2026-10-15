import { describe, expect, test } from 'bun:test'

import { MAX_SUBAGENT_REPORT_LENGTH } from 'strategydance-core'
import { ConversationNoteKind, ConversationRunStatus, ConversationTranscriptRole } from 'strategydance-database/backend'

import type { ConversationRunEnding } from '~domain/conversations/endConversationRun'

import buildSubagentReport from './buildSubagentReport'

const COMPLETED: ConversationRunEnding = { kind: 'finished', status: ConversationRunStatus.COMPLETED }

const AT_LIMIT: ConversationRunEnding = {
  kind: 'noted',
  status: ConversationRunStatus.FAILED,
  noteKind: ConversationNoteKind.FAILED,
  failure: 'The run sent its 25 requests',
  isAtLimit: true,
}

function entry(role: ConversationTranscriptRole, content: unknown[]) {
  return { role, content: JSON.stringify(content) }
}

function text(value: string) {
  return { type: 'text', text: value }
}

const BRIEF = entry(ConversationTranscriptRole.USER, [text('Compare the pricing pages')])
const CONTEXT = entry(ConversationTranscriptRole.SYSTEM, [text('Context from Strategy Dance')])

describe('buildSubagentReport', () => {
  test('reports the last text of its replies, never its brief or a context message', () => {
    const entries = [
      BRIEF,
      CONTEXT,
      entry(ConversationTranscriptRole.ASSISTANT, [
        text('Reading the first page.'),
        { type: 'tool_use', id: 'toolu_1', name: 'read_document', input: {} },
      ]),
      entry(ConversationTranscriptRole.USER, [{ type: 'tool_result', tool_use_id: 'toolu_1', content: '{}' }]),
      entry(ConversationTranscriptRole.ASSISTANT, [
        text('We are the cheapest '),
        { type: 'fallback' },
        text('of the three.'),
        { type: 'tool_use', id: 'toolu_2', name: 'read_document', input: {} },
      ]),
      entry(ConversationTranscriptRole.USER, [{ type: 'tool_result', tool_use_id: 'toolu_2', content: '{}' }]),
    ]

    expect(buildSubagentReport(COMPLETED, entries)).toBe('We are the cheapest of the three.')
    expect(buildSubagentReport(COMPLETED, [BRIEF, CONTEXT])).toBe('This subagent finished without writing a report.')
  })

  test('leads with how its run ended when it did not complete, and says so alone when it wrote nothing', () => {
    const entries = [BRIEF, CONTEXT, entry(ConversationTranscriptRole.ASSISTANT, [text('Two of three read.')])]

    expect(buildSubagentReport(AT_LIMIT, entries)).toBe(
      'This subagent stopped at its limits before it finished.\n\nTwo of three read.',
    )
    expect(
      buildSubagentReport(
        {
          kind: 'interrupted',
          reference: { organizationId: '', userId: '', conversationId: '', runId: '' },
          attempts: 1,
          failure: '',
        },
        [BRIEF],
      ),
    ).toBe('This subagent was interrupted before it finished.')
  })

  test('cuts its text within 8000 characters, the sentence included, at a line break, marked cut', () => {
    const code = `Findings:\n\n\`\`\`\n${'price,plan\n'.repeat(2000)}\`\`\``
    const entries = [entry(ConversationTranscriptRole.ASSISTANT, [text(code)])]
    const completed = buildSubagentReport(COMPLETED, entries)
    const failed = buildSubagentReport(AT_LIMIT, entries)

    expect(completed.length).toBeLessThanOrEqual(MAX_SUBAGENT_REPORT_LENGTH)
    expect(completed.startsWith('Findings:')).toBe(true)
    expect(completed.endsWith('price,plan…')).toBe(true)
    expect(completed.length).toBeGreaterThan(MAX_SUBAGENT_REPORT_LENGTH - 20)
    expect(failed.length).toBeLessThanOrEqual(MAX_SUBAGENT_REPORT_LENGTH)
    expect(failed.startsWith('This subagent stopped at its limits before it finished.\n\nFindings:')).toBe(true)
  })
})
