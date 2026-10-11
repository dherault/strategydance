import type { BetaTool } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import type { Tool } from '@modelcontextprotocol/client'

/*
  A module's tool as Claude takes one in the agent's requests: its name, its description and its
  input schema as the module wrote it, streamed as Claude writes it. It is not strict: a request
  takes at most 20 strict tools, 24 optional parameters and 16 union ones across them all, which the
  modules outgrow, and a strict schema takes no bound on a text's length or a number's range, and
  grows too complex with patterns. So Claude reads the whole schema, bounds and patterns included,
  and the module's own schema checks every call, answering one it refuses with a sentence the model
  can act on, as it answers an external agent. The dialect the schema names is left out, so a zod
  release naming another changes nothing a conversation replays
*/
function toConversationModuleTool({ name, description, inputSchema }: Tool): BetaTool {
  const { $schema: _dialect, ...schema } = inputSchema

  return {
    name,
    description: description ?? '',
    input_schema: schema as BetaTool['input_schema'],
    eager_input_streaming: true,
  }
}

export default toConversationModuleTool
