import type {
  BetaMessage,
  BetaMessageStreamParams,
  MessageCountTokensParams,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'

import type { ClaudeClient } from '~types'

// A stream that starts, reporting the usage of the message it began, then fails
type ScriptedFailure = { started: BetaMessage; error: Error }

// What the client answers a request with: a message, an error it throws, a stream failing partway,
// or any of them worked out from the request
type ScriptedAnswer =
  | BetaMessage
  | Error
  | ScriptedFailure
  | ((body: BetaMessageStreamParams) => BetaMessage | Error | ScriptedFailure)

type Options = {
  answers?: ScriptedAnswer[]
  // What a count answers, from the request counted
  count?: (body: MessageCountTokensParams) => number
  // What happens before each answer, a member removed say, given the request's signal, which a test
  // can wait on to see the request cut
  meanwhile?: (signal: AbortSignal) => unknown
}

/*
  A client for the tests, which reach no API: each request is recorded as the JSON text it would be
  sent as, then answered with the next scripted answer, a thinking block's text handed to
  `onProgress` and the message to `onUsage` first, as the real stream hands them. A request past the script is an error, so a test
  sees a request it did not expect. Counts are recorded as well, and answered by `count`
*/
function createScriptedClaudeClient({ answers = [], count = () => 0, meanwhile = () => {} }: Options = {}) {
  const queue = [...answers]
  // Each request's body as JSON text, as the SDK sends it, so a test compares bytes
  const requests: string[] = []
  const counts: MessageCountTokensParams[] = []

  const client: ClaudeClient = {
    async stream(body, { signal, onProgress, onUsage }) {
      requests.push(JSON.stringify(body))

      const next = queue.shift()

      if (!next) throw new Error(`The script has no answer for request ${requests.length}`)

      const answer = typeof next === 'function' ? next(body) : next

      if (!(answer instanceof Error) && 'started' in answer) onUsage?.(answer.started)

      if (!(answer instanceof Error) && !('started' in answer)) {
        for (const block of answer.content) {
          if (block.type === 'thinking' && block.thinking.trim()) onProgress(block.thinking.trim())
        }

        onUsage?.(answer)
      }

      await meanwhile(signal)

      signal.throwIfAborted()

      if (answer instanceof Error) throw answer
      if ('started' in answer) throw answer.error

      return answer
    },

    async countTokens(body) {
      counts.push(body)

      // As the count endpoint does, a result is refused without the call it answers
      for (const [index, message] of body.messages.entries()) {
        const previous = body.messages[index - 1]
        const calls = new Set(
          previous?.role === 'assistant' && Array.isArray(previous.content)
            ? previous.content.flatMap(block => (block.type === 'tool_use' ? [block.id] : []))
            : [],
        )

        if (
          Array.isArray(message.content)
          && message.content.some(block => block.type === 'tool_result' && !calls.has(block.tool_use_id))
        ) {
          throw new Error(`messages.${index}: a tool_result has no corresponding tool_use in the previous message`)
        }
      }

      return count(body)
    },
  }

  return {
    client,
    requests,
    counts,
    // The requests parsed, for a test reading their fields
    readRequests: () => requests.map(request => JSON.parse(request) as BetaMessageStreamParams),
  }
}

export default createScriptedClaudeClient
