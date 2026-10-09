import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'

type Options = {
  // A request may end with the run's context message, before it is stored with the run's first
  // part; a stored transcript never ends on one
  isRequest: boolean
  // Only the transcript's last entries, as a route checks the entry it adds after the turn it
  // answers, which need not open with the member's entry
  isTail?: boolean
}

/*
  Checks a transcript against the rules every flow keeps, and throws naming the first it breaks,
  so a request that would be refused, or teach Claude a broken history, is never sent:

  1. it opens with the member's entry, `user`
  2. a `system` message sits right after a `user` one and right before an `assistant` one: never
     first, never beside another, and last only as a request's unstored context
  3. an `assistant` message with `tool_use` blocks is followed by a `user` message opening with one
     `tool_result` per call, in their order, before anything else, and a `user` message holds no
     other `tool_result`
  4. so only the last message may hold calls with no result yet

  Calls Claude made on its own side, `server_tool_use`, carry their results within the turn and are
  none of these rules' business
*/
function checkTranscript(messages: BetaMessageParam[], { isRequest, isTail = false }: Options) {
  if (!isTail && messages[0] && messages[0].role !== 'user') {
    refuse(0, 'The transcript opens with the member’s entry')
  }

  messages.forEach((message, index) => {
    const previous = messages[index - 1]
    const next = messages[index + 1]

    if (message.role === 'system') {
      if (previous?.role !== 'user') refuse(index, 'A context message follows the member’s entry')
      if (next ? next.role !== 'assistant' : !isRequest) refuse(index, 'A context message comes right before a reply')
    }

    if (message.role === 'assistant' && next && next.role !== 'user' && readCalls(message).length) {
      refuse(index, 'Calls are answered by the next entry')
    }

    if (message.role !== 'user') return

    // The calls this entry answers, those of the reply right before it, and its results, each one
    // of them, in their order, before anything else
    const calls = previous?.role === 'assistant' ? readCalls(previous) : []
    const blocks = readBlocks(message)
    const resultCount = blocks.filter(block => block.type === 'tool_result').length
    const isAnswering =
      resultCount === calls.length
      && calls.every((call, callIndex) => {
        const block = blocks[callIndex]

        return block?.type === 'tool_result' && block.tool_use_id === call.id
      })

    if (!isAnswering) {
      refuse(index, 'An entry opens with the results of the calls before it, in their order, and no other')
    }
  })
}

function readBlocks(message: BetaMessageParam): Array<{ type: string; id?: unknown; tool_use_id?: unknown }> {
  return typeof message.content === 'string' ? [{ type: 'text' }] : message.content
}

function readCalls(message: BetaMessageParam) {
  return readBlocks(message).filter(block => block.type === 'tool_use')
}

function refuse(index: number, rule: string): never {
  throw new Error(`The transcript breaks a rule at message ${index}: ${rule}`)
}

export default checkTranscript
