import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'

type Options = {
  // A request may end with the run's context message, before it is stored with the run's first
  // part; a stored transcript never ends on one
  isRequest: boolean
}

/*
  Checks a transcript against the rules every flow keeps, and throws naming the first it breaks,
  so a request that would be refused, or teach Claude a broken history, is never sent:

  1. it opens with the member's entry, `user`
  2. a `system` message sits right after a `user` one and right before an `assistant` one: never
     first, never beside another, and last only as a request's unstored context
  3. an `assistant` message with `tool_use` blocks is followed by a `user` message opening with one
     `tool_result` per call, in their order, before anything else
  4. so only the last message may hold calls with no result yet

  Calls Claude made on its own side, `server_tool_use`, carry their results within the turn and are
  none of these rules' business
*/
function checkTranscript(messages: BetaMessageParam[], { isRequest }: Options) {
  if (messages[0] && messages[0].role !== 'user') refuse(0, 'The transcript opens with the member’s entry')

  messages.forEach((message, index) => {
    const previous = messages[index - 1]
    const next = messages[index + 1]

    if (message.role === 'system') {
      if (previous?.role !== 'user') refuse(index, 'A context message follows the member’s entry')
      if (next ? next.role !== 'assistant' : !isRequest) refuse(index, 'A context message comes right before a reply')
    }

    if (message.role !== 'assistant' || !next) return

    const calls = readBlocks(message).filter(block => block.type === 'tool_use')

    if (!calls.length) return
    if (next.role !== 'user') refuse(index, 'Calls are answered by the next entry')

    const results = readBlocks(next).slice(0, calls.length)

    calls.forEach((call, callIndex) => {
      const result = results[callIndex]

      if (result?.type !== 'tool_result' || result.tool_use_id !== call.id) {
        refuse(index + 1, 'An entry answering calls opens with their results, in their order')
      }
    })
  })
}

function readBlocks(message: BetaMessageParam): Array<{ type: string; id?: unknown; tool_use_id?: unknown }> {
  return typeof message.content === 'string' ? [{ type: 'text' }] : message.content
}

function refuse(index: number, rule: string): never {
  throw new Error(`The transcript breaks a rule at message ${index}: ${rule}`)
}

export default checkTranscript
