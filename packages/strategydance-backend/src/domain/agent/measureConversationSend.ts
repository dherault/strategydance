import type { BetaContentBlockParam, BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import type { ClaudeClient, ConversationContentBlock } from '~types'

import { buildConversationMessages } from '~domain/agent/buildConversationRequest'
import type { ConversationRequestTools } from '~domain/agent/buildConversationTools'
import { CONVERSATION_MODEL } from '~domain/agent/conversationRequestSettings'
import { countConfigTokens, findStartingRequest, sumRequest } from '~domain/agent/measureConversationRequest'
import replaceConversationFiles, { type ConversationFileTokens } from '~domain/agent/replaceConversationFiles'
import CONVERSATION_SYSTEM_PROMPT from '~domain/agent/systemPrompt'
import type { ConversationRunUsage } from '~domain/conversations/conversationRunUsage'
import type { ConversationTranscriptRecord } from '~domain/conversations/readConversationTranscript'

type MeasureConversationSendInput = {
  client: ClaudeClient
  // The tools the run's requests will send, the agent's own and its modules'
  tools: ConversationRequestTools
  // The stored transcript, in order
  entries: ConversationTranscriptRecord[]
  // The entry the send appends, as it will be stored
  entry: ConversationContentBlock[]
  // The context message the run it starts will send after that entry
  context: ConversationContentBlock[]
  // The conversation's latest runs, latest first, each with its ledger
  runs: { id: string; usage: ConversationRunUsage }[]
  // What each file of the conversation takes, the ones sent and the ones the send adds, by their ids
  // in the Files API
  fileTokens: ConversationFileTokens
}

/*
  How many input tokens the request a message with files leads to will take, measured before the
  message is stored, without building that request, so a message whose files the conversation has
  no room for is refused rather than filling it:

  - from the latest request whose part is still stored: its whole input, cached included, and its
    output, the change in the system prompt's and tools' tokens since, then everything after its
    part, the send's entry and the run's context message included, their text counted by the
    endpoint on one message holding only that text, which no estimate a script or an emoji could
    beat, and their files by what each upload counted
  - with no such request, a first message or a conversation whose runs stored no reply: everything
    counted whole, with the system prompt and the tools, the files by their counts
*/
async function measureConversationSend({
  client,
  tools,
  entries,
  entry,
  context,
  runs,
  fileTokens,
}: MeasureConversationSendInput) {
  const config = await countConfigTokens(client, tools)
  const appended: BetaMessageParam[] = [
    { role: 'user', content: entry as BetaContentBlockParam[] },
    { role: 'system', content: context as BetaContentBlockParam[] },
  ]
  const start = findStartingRequest(entries, runs)

  if (!start) {
    const counted = replaceConversationFiles(
      [...buildConversationMessages({ entries, context: null, parts: [] }), ...appended],
      fileTokens,
    )
    const inputTokens = await client.countTokens({
      model: CONVERSATION_MODEL,
      system: CONVERSATION_SYSTEM_PROMPT,
      tools,
      messages: counted.messages,
    })

    return inputTokens + counted.fileTokens
  }

  const following = [
    ...buildConversationMessages({ entries: entries.slice(start.index + 1), context: null, parts: [] }),
    ...appended,
  ]
  const counted = replaceConversationFiles(following, fileTokens)
  const texts = counted.messages.flatMap(readTexts)
  const textTokens = await client.countTokens({
    model: CONVERSATION_MODEL,
    messages: [{ role: 'user', content: texts.map(text => ({ type: 'text' as const, text })) }],
  })

  return sumRequest(start.request) + config - start.request.configTokens + textTokens + counted.fileTokens
}

// The words a message carries, whatever their block: text, a tool's result or input, thinking, and
// a document written inline
function readTexts(message: BetaMessageParam): string[] {
  if (typeof message.content === 'string') return [message.content]

  return message.content.flatMap(block => {
    if (block.type === 'text') return [block.text]
    if (block.type === 'thinking') return [block.thinking]
    if (block.type === 'tool_use') return [JSON.stringify(block.input)]
    if (block.type === 'document' && block.source.type === 'text') return [block.source.data]
    if (block.type === 'tool_result') {
      if (typeof block.content === 'string') return [block.content]

      return (block.content ?? []).flatMap(part => (part.type === 'text' ? [part.text] : []))
    }

    return []
  })
}

export default measureConversationSend
