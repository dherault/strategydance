import type { BetaMessageStreamParams } from '@anthropic-ai/sdk/resources/beta/messages/messages'

// The tool the agent asks the member a question with, which the thread draws as a question
export const ASK_USER_TOOL_NAME = 'ask_user'

/*
  The tools every conversation's requests send, the same list in the same order for all of them,
  since a change to it, like one to the system prompt, makes existing conversations lose their
  earlier reasoning once. Claude's own web search, which filters what it fetches before it reaches
  the context, at most five searches a request, then Strategy Dance's own tools, strict and
  streamed as Claude writes them. A strict schema takes no bounds on a text's length or a list's,
  so a tool's bounds are in its description and its input is checked against them before it runs.
  Later milestones append theirs
*/
const CONVERSATION_TOOLS: NonNullable<BetaMessageStreamParams['tools']> = [
  { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
  {
    name: ASK_USER_TOOL_NAME,
    description:
      'Ask the member a question with a few options to choose from, and wait for their answer. Call it when the member has to choose before you can go on, such as a price, a channel or a plan, rather than asking in your reply. Offer 2 to 6 short, distinct options. The member can always answer in their own words instead, so offer no "Other" option. The conversation waits until they answer, and their answer comes back as the options they chose and their own words. When they send a message instead, the question was skipped, and their message follows.',
    input_schema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The question, in the member’s language, on one line of at most 1000 characters',
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: '2 to 6 distinct options, in the member’s language, each on one line of at most 200 characters',
        },
        multiple: {
          type: 'boolean',
          description: 'Whether the member may choose several options, rather than one',
        },
      },
      required: ['prompt', 'options', 'multiple'],
      additionalProperties: false,
    },
    strict: true,
    eager_input_streaming: true,
  },
]

export default CONVERSATION_TOOLS
