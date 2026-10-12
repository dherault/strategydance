import type { ClaudeClient } from '~types'

import getAnthropicClient from '~domain/agent/getAnthropicClient'

// How long a count may take before it fails, and the step that asked for it is tried again: a run
// measures its requests against its own deadline, which a count that hung would carry it past
const COUNT_TIMEOUT_MS = 30 * 1000

/*
  The client that calls Claude through Anthropic's API, on the process's client
  (`getAnthropicClient`), which the Files API shares.

  A request is streamed, as the API asks of one that may run long, and answered with its final
  message. A thinking block with text, which `display: "updates"` turns into a short progress line,
  is handed to `onProgress` once it is whole, and the message so far to `onUsage` whenever the stream
  reports its usage, at its start and with each delta. The SDK retries what fails before the stream
  starts, twice; what fails after is the caller's
*/
function createAnthropicClaudeClient(): ClaudeClient {
  return {
    async stream(body, { signal, onProgress, onUsage }) {
      const stream = (await getAnthropicClient()).beta.messages.stream(body, { signal })

      stream.on('contentBlock', block => {
        if (block.type === 'thinking' && block.thinking.trim()) onProgress(block.thinking.trim())
      })
      stream.on('streamEvent', (event, snapshot) => {
        if (event.type === 'message_start' || event.type === 'message_delta') onUsage?.(snapshot)
      })

      return stream.finalMessage()
    },

    async countTokens(body) {
      const { input_tokens } = await (
        await getAnthropicClient()
      ).beta.messages.countTokens(body, {
        timeout: COUNT_TIMEOUT_MS,
      })

      return input_tokens
    },
  }
}

export default createAnthropicClaudeClient
