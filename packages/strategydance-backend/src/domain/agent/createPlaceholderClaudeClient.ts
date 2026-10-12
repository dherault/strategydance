import { setTimeout as wait } from 'node:timers/promises'

import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import type { ClaudeClient } from '~types'

import createClaudeMessage from '~domain/agent/createClaudeMessage'

// The progress lines it goes through, one after the other
const PLACEHOLDER_STEPS = ['Reading your message', 'Thinking it over', 'Weighing what to say', 'Writing a reply']

// What a count gives an image and a PDF in a request, in tokens, whatever their size
const PLACEHOLDER_IMAGE_TOKENS = 1500
const PLACEHOLDER_PDF_TOKENS = 3000

type Options = {
  // How long each step takes
  stepDurationMs?: number
}

/*
  A client that stands in for Claude in development, when `CONVERSATION_AGENT=placeholder` spares a
  developer what the real model costs: it goes through a few progress lines, two seconds each, long
  enough to restart the backend in the middle of a run, then answers one text block saying so. A
  run's request, its claim, lease and steps, the transcript, the thread and the run's end all work
  with it as they do with the model. A request that asks for an answer held to a schema, as the one
  that tags a conversation does, is answered at once with the strategy aspect. A count is the
  request's JSON length over four, which is all the full-conversation measurement needs of it, an
  image and a PDF counted at a fixed allowance instead
*/
function createPlaceholderClaudeClient({ stepDurationMs = 2000 }: Options = {}): ClaudeClient {
  return {
    async stream(body, { signal, onProgress }) {
      if (body.output_config?.format) {
        return createClaudeMessage({
          content: [{ type: 'text', text: JSON.stringify({ aspects: ['STRATEGY'] }), citations: null }],
          usage: { inputTokens: Math.ceil(JSON.stringify(body).length / 4), outputTokens: 10 },
        })
      }

      for (const step of PLACEHOLDER_STEPS) {
        onProgress(step)

        await wait(stepDurationMs, undefined, { signal })
      }

      // In graphemes, as the member counts them, so an emoji is one
      const text = readLastMemberText(body.messages)
      const length = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length

      return createClaudeMessage({
        content: [
          {
            type: 'text',
            text: `Strategy Dance cannot answer yet, so this reply stands in for it.\n\nYour message held **${length}** characters.`,
            citations: null,
          },
        ],
        usage: { inputTokens: Math.ceil(JSON.stringify(body).length / 4), outputTokens: 20 },
      })
    },

    async countTokens(body) {
      let files = 0

      // An image or a PDF counted at a fixed allowance, about what Claude counts for one, rather than
      // its base64 over four, which would fill a conversation with one PDF
      const messages = body.messages.map(message => {
        if (typeof message.content === 'string') return message

        return {
          ...message,
          content: message.content.filter(block => {
            if (block.type === 'image') files += PLACEHOLDER_IMAGE_TOKENS
            else if (block.type === 'document' && block.source.type === 'base64') files += PLACEHOLDER_PDF_TOKENS
            else return true

            return false
          }),
        }
      })

      return Math.ceil(JSON.stringify({ ...body, messages }).length / 4) + files
    },
  }
}

// The text of the member's message the request answers, its last `user` message
function readLastMemberText(messages: BetaMessageParam[]) {
  const message = messages.findLast(({ role }) => role === 'user')

  if (!message) return ''
  if (typeof message.content === 'string') return message.content

  return message.content.map(block => (block.type === 'text' ? block.text : '')).join('')
}

export default createPlaceholderClaudeClient
