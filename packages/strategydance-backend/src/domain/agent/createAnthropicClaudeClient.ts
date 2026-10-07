import Anthropic from '@anthropic-ai/sdk'

import type { ClaudeClient } from '~types'

import { SECRET_ANTHROPIC_API_KEY } from '~constants'

import retrieveSecret from '~utils/retrieveSecret'

/*
  The client that calls Claude through Anthropic's API. Its key is `ANTHROPIC_API_KEY` when set, as
  on a machine whose credentials cannot read the secret, and the `anthropic-api-key` secret
  otherwise, read once per process and again only after a read that failed.

  A request is streamed, as the API asks of one that may run long, and answered with its final
  message. A thinking block with text, which `display: "updates"` turns into a short progress line,
  is handed to `onProgress` once it is whole, and the message so far to `onUsage` whenever the stream
  reports its usage, at its start and with each delta. The SDK retries what fails before the stream
  starts, twice; what fails after is the caller's
*/
function createAnthropicClaudeClient(): ClaudeClient {
  let client: Promise<Anthropic> | null = null

  function getClient() {
    if (!client) {
      client = (async () =>
        new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || (await retrieveSecret(SECRET_ANTHROPIC_API_KEY)) }))()

      client.catch(() => {
        client = null
      })
    }

    return client
  }

  return {
    async stream(body, { signal, onProgress, onUsage }) {
      const stream = (await getClient()).beta.messages.stream(body, { signal })

      stream.on('contentBlock', block => {
        if (block.type === 'thinking' && block.thinking.trim()) onProgress(block.thinking.trim())
      })
      stream.on('streamEvent', (event, snapshot) => {
        if (event.type === 'message_start' || event.type === 'message_delta') onUsage?.(snapshot)
      })

      return stream.finalMessage()
    },

    async countTokens(body) {
      const { input_tokens } = await (await getClient()).beta.messages.countTokens(body)

      return input_tokens
    },
  }
}

export default createAnthropicClaudeClient
