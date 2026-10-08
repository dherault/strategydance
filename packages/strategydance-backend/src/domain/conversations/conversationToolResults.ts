import type { ConversationAnswer } from 'strategydance-core'

/*
  The result of one of Strategy Dance's own tools' calls, as the entry that answers a turn's calls
  sends it: JSON text when the call went through, and a sentence Claude can act on, `is_error`, when
  it did not
*/
export type ConversationToolResult = {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: true
}

// How much of a call's output goes back to Claude, the rest cut with a note saying so
export const MAX_TOOL_RESULT_LENGTH = 50000

export const SKIPPED_QUESTION_RESULT = 'The member skipped this question.'
export const STOPPED_CALL_RESULT = 'The member stopped the response before this ran.'
export const INTERRUPTED_CALL_RESULT = 'This call was interrupted and may have run. Check before you rely on it.'

export function toSucceededResult(toolUseId: string, content: string): ConversationToolResult {
  return { type: 'tool_result', tool_use_id: toolUseId, content }
}

export function toFailedResult(toolUseId: string, reason: string): ConversationToolResult {
  return { type: 'tool_result', tool_use_id: toolUseId, content: reason, is_error: true }
}

// A question's answer, as the options chosen and the member's own words when they wrote any
export function toAnswerResult(toolUseId: string, answer: ConversationAnswer) {
  return toSucceededResult(
    toolUseId,
    JSON.stringify({ selected: answer.selected, ...(answer.other ? { other: answer.other } : {}) }),
  )
}

/*
  A call's output as JSON text, within `MAX_TOOL_RESULT_LENGTH` characters. A longer one is cut,
  and still JSON: the start of its text, cut between two code points so no character is split, with
  a note saying so, as much of it as fits once escaped
*/
export function toToolOutput(output: unknown) {
  const text = JSON.stringify(output ?? null)

  if (text.length <= MAX_TOOL_RESULT_LENGTH) return text

  const note = `The output was cut to fit ${MAX_TOOL_RESULT_LENGTH} characters, of its ${text.length}`
  let end = MAX_TOOL_RESULT_LENGTH

  // Each character left out takes one at least from what escaping it adds, so this ends
  for (;;) {
    const kept = /[\uD800-\uDBFF]/.test(text.charAt(end - 1)) ? end - 1 : end
    const cut = JSON.stringify({ note, text: text.slice(0, kept) })

    if (cut.length <= MAX_TOOL_RESULT_LENGTH) return cut

    end = Math.max(0, kept - (cut.length - MAX_TOOL_RESULT_LENGTH))
  }
}

// What the thread shows of a call that failed, its output: the sentence Claude was sent, as JSON
export function toFailedOutput(reason: string) {
  return JSON.stringify({ error: reason })
}

// The sentence a call that failed was answered with, from its output, or null for any other output
export function readFailedOutput(output: string | null) {
  try {
    const { error } = JSON.parse(output ?? 'null') as { error?: unknown }

    return typeof error === 'string' ? error : null
  } catch {
    return null
  }
}

/*
  The results of a turn's calls that finished, which its run keeps in `pendingToolResults` until
  the entry that sends them is stored, by the id of the call each answers. JSON text, as the
  transcript is, so a result holding U+0000 is kept as it came
*/
export function parsePendingToolResults(text: string | null | undefined) {
  const results = new Map<string, ConversationToolResult>()

  if (!text) return results

  const parsed: unknown = JSON.parse(text)

  if (!Array.isArray(parsed)) throw new Error('A run keeps its pending results as a list')

  for (const result of parsed as ConversationToolResult[]) results.set(result.tool_use_id, result)

  return results
}

export function serializePendingToolResults(results: Map<string, ConversationToolResult>) {
  return JSON.stringify([...results.values()])
}
