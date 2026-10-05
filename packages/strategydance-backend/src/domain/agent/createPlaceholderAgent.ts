import { setTimeout as wait } from 'node:timers/promises'

import type { ConversationAgent, ConversationContentBlock, ConversationTextBlock } from '~types'

// The progress lines it goes through, one after the other
const PLACEHOLDER_STEPS = ['Reading your message', 'Thinking it over', 'Weighing what to say', 'Writing a reply']

type Options = {
  // How long each step takes
  stepDurationMs?: number
}

/*
  An agent that stands in for Claude until it answers conversations: it goes through a few
  progress lines, two seconds each, long enough to restart the backend in the middle of a run, then
  answers with one text block saying so. A send, a run's claim, lease and steps, the transcript, the
  thread and the ends of a run all work with it as they will with the model
*/
function createPlaceholderAgent({ stepDurationMs = 2000 }: Options = {}): ConversationAgent {
  return {
    async respond({ lastEntry, signal, onStep }) {
      for (const step of PLACEHOLDER_STEPS) {
        onStep(step)

        await wait(stepDurationMs, undefined, { signal })
      }

      // In graphemes, as the member counts them, so an emoji is one
      const text = lastEntry
        .filter(isTextBlock)
        .map(block => block.text)
        .join('')
      const length = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length

      return {
        content: [
          {
            type: 'text',
            text: `Strategy Dance cannot answer yet, so this reply stands in for it.\n\nYour message held **${length}** characters.`,
          },
        ],
      }
    },
  }
}

function isTextBlock(block: ConversationContentBlock): block is ConversationTextBlock {
  return block.type === 'text' && typeof block.text === 'string'
}

export default createPlaceholderAgent
