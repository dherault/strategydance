import type {
  BetaMessage,
  BetaMessageStreamParams,
  MessageCountTokensParams,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'

import type { ClaudeClient } from '~types'

// What the client answers a request with: a message, an error it throws, or either worked out from
// the request
type ScriptedAnswer = BetaMessage | Error | ((body: BetaMessageStreamParams) => BetaMessage | Error)

type Options = {
  answers?: ScriptedAnswer[]
  // What a count answers, from the request counted
  count?: (body: MessageCountTokensParams) => number
  // What happens before each answer, a member removed say
  meanwhile?: () => unknown
}

/*
  A client for the tests, which reach no API: each request is recorded as the JSON text it would be
  sent as, then answered with the next scripted answer, a thinking block's text handed to
  `onProgress` first as the real stream hands it. A request past the script is an error, so a test
  sees a request it did not expect. Counts are recorded as well, and answered by `count`
*/
function createScriptedClaudeClient({ answers = [], count = () => 0, meanwhile = () => {} }: Options = {}) {
  const queue = [...answers]
  // Each request's body as JSON text, as the SDK sends it, so a test compares bytes
  const requests: string[] = []
  const counts: MessageCountTokensParams[] = []

  const client: ClaudeClient = {
    async stream(body, { signal, onProgress }) {
      requests.push(JSON.stringify(body))

      await meanwhile()

      signal.throwIfAborted()

      const next = queue.shift()

      if (!next) throw new Error(`The script has no answer for request ${requests.length}`)

      const answer = typeof next === 'function' ? next(body) : next

      if (answer instanceof Error) throw answer

      for (const block of answer.content) {
        if (block.type === 'thinking' && block.thinking.trim()) onProgress(block.thinking.trim())
      }

      return answer
    },

    async countTokens(body) {
      counts.push(body)

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
